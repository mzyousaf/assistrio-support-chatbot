import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, RefreshCw } from 'lucide-react';
import {
  getAdminWorkspaceSupportSummary,
  getAdminWorkspaceUsageAnalytics,
  postAdminReplayWebhookEvent,
} from '@/api/adminApi';
import type { AdminWorkspaceSupportSummary, AdminWorkspaceUsageAnalytics } from '@/api/types';
import { WorkspaceLoadFailureCard } from '@/components/WorkspaceLoadFailureCard';
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { InlineLoader } from '@/components/PageLoader';
import { DataPageLayout } from '@/layout/workspace-layout';
import { copyTextToClipboard } from '@/lib/copyToClipboard';
import { formatAdminDate, formatAdminDateTime } from '@/lib/formatAdminDate';
import { cn } from '@/lib/utils';
import { AdminWorkspaceBillingSection } from './AdminWorkspaceBillingSection';
import {
  formatAiCreditsUsageLabel,
  formatPlanBadgeLabel,
  formatSubscriptionStatusLabel,
  formatUsagePeriodDate,
} from './adminBillingDisplay';

type SupportTab =
  | 'overview'
  | 'billing'
  | 'usage'
  | 'agents'
  | 'members'
  | 'knowledge'
  | 'conversations'
  | 'webhooks'
  | 'danger';

const TABS: { id: SupportTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'billing', label: 'Billing' },
  { id: 'usage', label: 'Usage' },
  { id: 'agents', label: 'Agents' },
  { id: 'members', label: 'Members' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'danger', label: 'Danger' },
];

function SummaryCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-[var(--shadow-card)]">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className="m-0 mt-1 text-sm font-semibold text-slate-900">{props.value}</p>
      {props.hint ? <p className="m-0 mt-1 text-xs text-slate-500">{props.hint}</p> : null}
    </div>
  );
}

function CopyIdButton(props: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => {
        void copyTextToClipboard(props.value).then((ok) => {
          if (ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }
        });
      }}
    >
      <Copy size={14} aria-hidden />
      {copied ? 'Copied' : props.label}
    </Button>
  );
}

function EmptyState(props: { message: string }) {
  return <p className="m-0 text-sm text-slate-500">{props.message}</p>;
}

function SupportTable(props: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
}) {
  if (props.rows.length === 0) return <EmptyState message={props.empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-slate-100 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
            {props.headers.map((h) => (
              <th key={h} className="px-2 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-2 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebhooksTab(props: {
  summary: AdminWorkspaceSupportSummary;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { summary, onRefresh, refreshing } = props;
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  const handleReplay = async (eventId: string) => {
    setReplayingEventId(eventId);
    setReplayMessage(null);
    setReplayError(null);
    const res = await postAdminReplayWebhookEvent(eventId);
    setReplayingEventId(null);
    if (!res.ok || !res.data.replayed) {
      setReplayError(res.ok ? (res.data.message ?? 'Replay failed.') : (res.error ?? 'Replay failed.'));
      return;
    }
    setReplayMessage(res.data.message ?? 'Webhook replayed successfully.');
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-sm text-slate-600">
            Failed webhooks: <strong>{summary.webhookHealth.failedCount}</strong>
            {summary.webhookHealth.lastProcessedAt
              ? ` · Last processed ${formatAdminDateTime(summary.webhookHealth.lastProcessedAt)}`
              : ''}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={refreshing} onClick={onRefresh}>
          <RefreshCw size={14} aria-hidden className={refreshing ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </div>
      {replayMessage ? <p className="m-0 text-sm text-emerald-700">{replayMessage}</p> : null}
      {replayError ? <p className="m-0 text-sm text-red-700">{replayError}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900">Recent billing webhook events</CardTitle>
          <CardDescription>Lemon Squeezy events linked to this workspace.</CardDescription>
        </CardHeader>
        <CardBody className="pt-0">
          <SupportTable
            empty="No webhook events found for this workspace."
            headers={['Event', 'Status', 'Created', 'Processed', 'Error', 'Action']}
            rows={summary.recentEvents.map((row) => {
              const canReplay = row.status === 'failed' || row.status === 'received';
              return [
                row.eventName,
                row.status,
                formatAdminDate(row.createdAt),
                row.processedAt ? formatAdminDate(row.processedAt) : '—',
                row.processingError ?? '—',
                canReplay ? (
                  <Button
                    key={`replay-${row.id}`}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={replayingEventId === row.id}
                    onClick={() => void handleReplay(row.id)}
                  >
                    {replayingEventId === row.id ? 'Replaying…' : 'Replay'}
                  </Button>
                ) : (
                  '—'
                ),
              ];
            })}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function UsageTab(props: { workspaceId: string; summary: AdminWorkspaceSupportSummary }) {
  const { workspaceId, summary } = props;
  const [analytics, setAnalytics] = useState<AdminWorkspaceUsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botFilter, setBotFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAdminWorkspaceUsageAnalytics(workspaceId, {
      botIds: botFilter || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setAnalytics(null);
      setError(res.error);
      return;
    }
    setAnalytics(res.data);
  }, [workspaceId, botFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const aiCredits = summary.usage.aiCredits;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Monthly credits"
          value={formatAiCreditsUsageLabel(aiCredits.monthlyCreditsUsed, aiCredits.monthlyCredits)}
          hint={`Period ends ${formatUsagePeriodDate(aiCredits.periodEnd)}`}
        />
        <SummaryCard
          label="Top-up credits remaining"
          value={String(aiCredits.topUpCreditsRemaining ?? 0)}
        />
        <SummaryCard
          label="Agents over limit"
          value={String(summary.usage.lockedAgentsCount)}
        />
        <SummaryCard
          label="Members inactive (over limit)"
          value={String(summary.usage.inactiveMembersCount)}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Agent filter
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            value={botFilter}
            onChange={(e) => setBotFilter(e.target.value)}
          >
            <option value="">All agents</option>
            {summary.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          Apply
        </Button>
      </div>

      {loading ? <InlineLoader title="Loading usage analytics…" /> : null}
      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}

      {!loading && analytics ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">AI credits by agent</CardTitle>
              <CardDescription>
                {formatUsagePeriodDate(analytics.dateRange.startDate)} –{' '}
                {formatUsagePeriodDate(analytics.dateRange.endDate)}
              </CardDescription>
            </CardHeader>
            <CardBody className="pt-0">
              <SupportTable
                empty="No AI credit usage in this range."
                headers={['Agent', 'Total', 'Monthly', 'Top-up', 'Messages']}
                rows={analytics.aiCreditsByAgent.map((row) => [
                  row.botName,
                  row.totalCreditsUsed,
                  row.monthlyCreditsUsed,
                  row.topUpCreditsUsed,
                  row.messageCount,
                ])}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">Usage trend</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <SupportTable
                empty="No usage trend data in this range."
                headers={['Date', 'Total', 'Monthly', 'Top-up']}
                rows={analytics.usageTrend.map((row) => [
                  row.date,
                  row.totalCreditsUsed,
                  row.monthlyCreditsUsed,
                  row.topUpCreditsUsed,
                ])}
              />
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export function AdminWorkspaceSupportPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const [summary, setSummary] = useState<AdminWorkspaceSupportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<SupportTab>('overview');

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    const res = await getAdminWorkspaceSupportSummary(workspaceId);
    setLoading(false);
    if (!res.ok) {
      setSummary(null);
      setError(res.error);
      return;
    }
    setSummary(res.data);
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setRefreshing(true);
    const res = await getAdminWorkspaceSupportSummary(workspaceId);
    setRefreshing(false);
    if (res.ok) setSummary(res.data);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const planLabel = useMemo(() => {
    if (!summary) return '—';
    return formatPlanBadgeLabel(summary.billing.plan.name, summary.billing.plan.key);
  }, [summary]);

  const statusLabel = useMemo(() => {
    if (!summary) return '—';
    return formatSubscriptionStatusLabel(
      summary.subscription && typeof summary.subscription === 'object' && 'subscriptionStatus' in summary.subscription
        ? String(summary.subscription.subscriptionStatus)
        : summary.billing.plan.status,
    );
  }, [summary]);

  if (loading) {
    return (
      <DataPageLayout embedded title="Workspace support" description="Loading workspace…" containerSize="full">
        <InlineLoader title="Loading workspace support summary…" />
      </DataPageLayout>
    );
  }

  if (error || !summary) {
    return (
      <DataPageLayout embedded title="Workspace support" containerSize="full">
        <WorkspaceLoadFailureCard
          icon="not_found"
          title="Could not load workspace"
          description={error ?? 'Workspace not found.'}
          onPrimary={() => void load()}
          primaryLabel="Retry"
          secondary={{ to: '/customers', label: 'Back to customers' }}
        />
      </DataPageLayout>
    );
  }

  return (
    <DataPageLayout
      embedded
      title={summary.workspace.name}
      description={
        <span className="font-mono text-[0.8125rem] text-slate-500" title={summary.workspace.id}>
          {summary.workspace.id}
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-teal-800 ring-1 ring-teal-100">
            {planLabel}
          </span>
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-slate-700 ring-1 ring-slate-200/80">
            {statusLabel}
          </span>
          <Button type="button" variant="secondary" size="sm" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden className={refreshing ? 'animate-spin' : undefined} />
            Refresh
          </Button>
          <CopyIdButton label="Copy workspace id" value={summary.workspace.id} />
        </div>
      }
      containerSize="full"
    >
      <div className="mb-6">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 rounded-[var(--ui-radius)] px-2 py-1 text-[0.8125rem] font-medium text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to customers
        </Link>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Workspace"
          value={summary.workspace.name}
          hint={`Created ${formatAdminDate(summary.workspace.createdAt)} · ${summary.workspace.onboardingStatus ?? 'unknown status'}`}
        />
        <SummaryCard
          label="Owner"
          value={summary.owner?.name ?? '—'}
          hint={summary.owner?.email ?? undefined}
        />
        <SummaryCard label="Plan" value={planLabel} hint={statusLabel} />
        <SummaryCard
          label="Usage / limits"
          value={formatAiCreditsUsageLabel(
            summary.usage.aiCredits.monthlyCreditsUsed,
            summary.usage.aiCredits.monthlyCredits,
          )}
          hint={`${summary.usage.bots.current}/${summary.usage.bots.limit} agents · ${summary.usage.members.used}/${summary.usage.members.limit} members`}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200/90 pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
              tab === item.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">At a glance</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 pt-0 text-sm text-slate-700">
              <p className="m-0">
                Locked agents: <strong>{summary.usage.lockedAgentsCount}</strong>
              </p>
              <p className="m-0">
                Inactive members (over limit): <strong>{summary.usage.inactiveMembersCount}</strong>
              </p>
              <p className="m-0">
                Pending invites: <strong>{summary.usage.members.pendingInvites}</strong>
              </p>
              <p className="m-0">
                Failed webhooks: <strong>{summary.webhookHealth.failedCount}</strong>
              </p>
              <p className="m-0">
                Top-up credits: <strong>{summary.usage.aiCredits.topUpCreditsRemaining}</strong>
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">Recent conversations</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <SupportTable
                empty="No conversations yet."
                headers={['Agent', 'Source', 'Messages', 'Credits', 'Last activity']}
                rows={summary.conversations.slice(0, 5).map((row) => [
                  row.botName,
                  row.startedFrom ?? '—',
                  row.messageCount ?? '—',
                  row.creditsUsed ?? '—',
                  row.lastActivityAt ? formatAdminDateTime(row.lastActivityAt) : '—',
                ])}
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'billing' ? <AdminWorkspaceBillingSection workspaceId={workspaceId} /> : null}
      {tab === 'usage' ? <UsageTab workspaceId={workspaceId} summary={summary} /> : null}

      {tab === 'agents' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">Workspace agents</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <SupportTable
              empty="No agents in this workspace."
              headers={['Name', 'Status', 'Locked', 'Share preview', 'KB', 'Conversations', 'Credits', 'Actions']}
              rows={summary.agents.map((agent) => [
                agent.name,
                agent.status,
                agent.isOverLimitLocked ? (
                  <span className="font-medium text-amber-800">{agent.lockedReason ?? 'locked'}</span>
                ) : (
                  '—'
                ),
                agent.sharePreviewEnabled ? agent.sharePreviewStatus ?? 'enabled' : 'off',
                agent.kbUsedMb != null && agent.kbMaxMb != null ? `${agent.kbUsedMb}/${agent.kbMaxMb} MB` : '—',
                agent.conversationCount ?? '—',
                agent.creditsUsedThisPeriod,
                <CopyIdButton key={`copy-${agent.id}`} label="Copy id" value={agent.id} />,
              ])}
            />
          </CardBody>
        </Card>
      ) : null}

      {tab === 'members' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">Members</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <SupportTable
                empty="No members found."
                headers={['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions']}
                rows={summary.members.map((member) => [
                  <>
                    {member.name}
                    {member.role === 'owner' ? (
                      <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-indigo-800">
                        Owner
                      </span>
                    ) : null}
                  </>,
                  member.email,
                  member.role,
                  member.membershipStatus === 'inactive_over_limit' ? (
                    <span className="font-medium text-amber-800">inactive_over_limit</span>
                  ) : (
                    member.membershipStatus
                  ),
                  member.joinedAt ? formatAdminDate(member.joinedAt) : '—',
                  <CopyIdButton key={`copy-${member.userId}`} label="Copy id" value={member.userId} />,
                ])}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">Invites</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <SupportTable
                empty="No pending or recent invites."
                headers={['Email', 'Role', 'Status', 'Created', 'Expires']}
                rows={summary.invites.map((invite) => [
                  invite.email,
                  invite.role,
                  invite.status,
                  invite.createdAt ? formatAdminDate(invite.createdAt) : '—',
                  invite.expiresAt ? formatAdminDate(invite.expiresAt) : '—',
                ])}
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'knowledge' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">Trained knowledge by agent</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <SupportTable
              empty="No trained knowledge usage recorded."
              headers={['Agent', 'Used', 'Max', 'Percent']}
              rows={summary.knowledge.map((row) => [
                row.botName,
                `${row.usedMb} MB`,
                `${row.maxMb} MB`,
                `${row.percentUsed}%`,
              ])}
            />
          </CardBody>
        </Card>
      ) : null}

      {tab === 'conversations' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">Recent conversations</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <SupportTable
              empty="No conversations yet."
              headers={['Agent', 'Source', 'Messages', 'Credits', 'Lead', 'Country', 'Device', 'Last activity', 'Actions']}
              rows={summary.conversations.map((row) => [
                row.botName,
                row.startedFrom ?? '—',
                row.messageCount ?? '—',
                row.creditsUsed ?? '—',
                row.leadCaptured ? 'Yes' : '—',
                row.country ?? '—',
                row.device ?? '—',
                row.lastActivityAt ? formatAdminDateTime(row.lastActivityAt) : '—',
                <CopyIdButton key={`copy-${row.id}`} label="Copy id" value={row.id} />,
              ])}
            />
          </CardBody>
        </Card>
      ) : null}

      {tab === 'webhooks' ? (
        <WebhooksTab summary={summary} onRefresh={() => void refresh()} refreshing={refreshing} />
      ) : null}

      {tab === 'danger' ? (
        <Card className="border-amber-200/90">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">Support actions</CardTitle>
            <CardDescription>
              Destructive workspace actions are not enabled in this view. Use billing sync and webhook replay from
              Billing or Webhooks tabs for safe support operations.
            </CardDescription>
          </CardHeader>
          <CardBody className="pt-0">
            <EmptyState message="No danger-zone actions are exposed yet." />
          </CardBody>
        </Card>
      ) : null}
    </DataPageLayout>
  );
}
