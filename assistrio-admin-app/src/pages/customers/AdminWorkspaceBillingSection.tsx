import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getAdminWorkspaceBillingSummary,
  postAdminReplayWebhookEvent,
  postAdminWorkspaceBillingSync,
} from '@/api/adminApi';
import type { AdminWorkspaceBillingSummary } from '@/api/types';
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { formatAdminDate } from '@/lib/formatAdminDate';
import {
  formatAnalyticsHistoryLabel,
  formatBrandingRemovalLabel,
  formatExportReportsLabel,
  formatSubscriptionStatusLabel,
  formatUsagePeriodDate,
} from './adminBillingDisplay';

type LoadState = 'idle' | 'loading' | 'ok' | 'error';

export function AdminWorkspaceBillingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading billing details">
      <div className="h-28 animate-pulse rounded-xl border border-slate-200/90 bg-slate-50" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-200/90 bg-slate-50" />
        ))}
      </div>
    </div>
  );
}

function BillingMetric(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-3">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className="m-0 mt-1 text-sm font-medium text-slate-900">{props.value}</p>
      {props.hint ? <p className="m-0 mt-1 text-xs leading-relaxed text-slate-500">{props.hint}</p> : null}
    </div>
  );
}

function ReadOnlyTable(props: {
  title: string;
  description?: string;
  empty: string;
  headers: string[];
  rows: Array<Array<string>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-900">{props.title}</CardTitle>
        {props.description ? <CardDescription>{props.description}</CardDescription> : null}
      </CardHeader>
      <CardBody className="overflow-x-auto pt-0">
        {props.rows.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">{props.empty}</p>
        ) : (
          <table className="w-full min-w-[28rem] border-collapse text-left text-[0.8125rem]">
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
        )}
      </CardBody>
    </Card>
  );
}

function WebhookEventsTable(props: {
  events: NonNullable<AdminWorkspaceBillingSummary['support']>['webhookEvents'];
  replayingEventId: string | null;
  onReplay: (eventId: string) => void;
}) {
  const { events, replayingEventId, onReplay } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-900">Recent webhook events</CardTitle>
        <CardDescription>
          Events whose checkout custom data references this workspace (latest 20).
        </CardDescription>
      </CardHeader>
      <CardBody className="overflow-x-auto pt-0">
        {events.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">No webhook events found for this workspace.</p>
        ) : (
          <table className="w-full min-w-[32rem] border-collapse text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-slate-100 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Event</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Processed</th>
                <th className="px-2 py-2">Error</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((row) => {
                const canReplay = row.status === 'failed' || row.status === 'received';
                return (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-2 py-2 text-slate-700">{row.eventName}</td>
                    <td className="px-2 py-2 text-slate-700">{row.status}</td>
                    <td className="px-2 py-2 text-slate-700">{formatAdminDate(row.createdAt)}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {row.processedAt ? formatAdminDate(row.processedAt) : '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-700">{row.processingError ?? '—'}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {canReplay ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={replayingEventId === row.id}
                          onClick={() => onReplay(row.id)}
                        >
                          {replayingEventId === row.id ? 'Replaying…' : 'Replay'}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );
}

export function AdminWorkspaceBillingSection(props: { workspaceId: string }) {
  const { workspaceId } = props;
  const [summary, setSummary] = useState<AdminWorkspaceBillingSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setError(null);
    const res = await getAdminWorkspaceBillingSummary(workspaceId);
    if (res.ok) {
      setSummary(res.data);
      setLoadState('ok');
      return;
    }
    setSummary(null);
    setError(res.error);
    setLoadState('error');
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);
    const res = await postAdminWorkspaceBillingSync(workspaceId);
    setSyncing(false);
    if (!res.ok) {
      setSyncError(res.error ?? 'Sync failed.');
      return;
    }
    setSyncMessage(res.data.message);
    await load();
  };

  const handleReplay = async (eventId: string) => {
    setReplayingEventId(eventId);
    setReplayMessage(null);
    setReplayError(null);
    const res = await postAdminReplayWebhookEvent(eventId);
    setReplayingEventId(null);
    if (!res.ok) {
      setReplayError(res.error ?? 'Replay failed.');
      return;
    }
    if (!res.data.replayed) {
      setReplayError(res.data.message ?? 'Replay failed.');
      return;
    }
    setReplayMessage(res.data.message ?? 'Webhook replayed successfully.');
    await load();
  };

  if (loadState === 'loading' || loadState === 'idle') {
    return <AdminWorkspaceBillingSkeleton />;
  }

  if (loadState === 'error' || !summary) {
    return (
      <Card className="border-amber-200/90 bg-amber-50/70">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden />
            <div className="min-w-0">
              <p className="m-0 font-semibold text-amber-950">Could not load billing details</p>
              <p className="m-0 mt-1 text-sm leading-relaxed text-amber-900/90">
                {error || 'Billing summary unavailable.'}
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  const { plan, entitlements, usage, admin, support } = summary;
  const provider = support?.provider;
  const activeAddonNames = entitlements.activeAddons.length
    ? entitlements.activeAddons.join(', ')
    : 'None';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-slate-500">Support billing view · read-only</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={syncing}
          onClick={() => void handleSync()}
        >
          <RefreshCw size={14} className={syncing ? 'mr-1.5 animate-spin' : 'mr-1.5'} aria-hidden />
          {syncing ? 'Syncing…' : 'Sync billing'}
        </Button>
      </div>
      {syncMessage ? (
        <p className="m-0 rounded-lg border border-teal-200/80 bg-teal-50/80 px-3 py-2 text-sm text-teal-950" role="status">
          {syncMessage}
        </p>
      ) : null}
      {syncError ? (
        <p className="m-0 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950" role="alert">
          {syncError}
        </p>
      ) : null}
      {replayMessage ? (
        <p className="m-0 rounded-lg border border-teal-200/80 bg-teal-50/80 px-3 py-2 text-sm text-teal-950" role="status">
          {replayMessage}
        </p>
      ) : null}
      {replayError ? (
        <p className="m-0 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950" role="alert">
          {replayError}
        </p>
      ) : null}

      <Card className="border-teal-200/70 bg-teal-50/20">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Billing & usage</CardTitle>
          <CardDescription>
            {plan.name} · {formatSubscriptionStatusLabel(plan.status)} · read-only
          </CardDescription>
        </CardHeader>
        <CardBody className="grid gap-3 pt-0 md:grid-cols-2 xl:grid-cols-3">
          <BillingMetric
            label="Billing period"
            value={`${formatUsagePeriodDate(plan.currentPeriodStart)} – ${formatUsagePeriodDate(plan.currentPeriodEnd)}`}
          />
          <BillingMetric
            label="AI credits"
            value={`${usage.aiCredits.monthlyCreditsUsed.toLocaleString()} / ${usage.aiCredits.monthlyCredits.toLocaleString()} used`}
            hint={`${usage.aiCredits.totalCreditsRemaining.toLocaleString()} remaining this period`}
          />
          <BillingMetric label="Agents" value={`${usage.bots.current} / ${usage.bots.limit}`} />
          <BillingMetric
            label="Members"
            value={`${usage.members.used} / ${usage.members.limit}`}
            hint={
              usage.members.pendingInvites > 0
                ? `${usage.members.pendingInvites} pending invite${usage.members.pendingInvites === 1 ? '' : 's'}`
                : undefined
            }
          />
          <BillingMetric
            label="Analytics history"
            value={formatAnalyticsHistoryLabel(entitlements.analyticsHistoryDays)}
          />
          <BillingMetric
            label="Export reports"
            value={formatExportReportsLabel(entitlements.canExportReports)}
          />
          <BillingMetric
            label="Branding"
            value={formatBrandingRemovalLabel(entitlements.canRemoveBranding)}
          />
          <BillingMetric label="Add-ons (entitlements)" value={activeAddonNames} />
          <BillingMetric
            label="Top-up credits"
            value={entitlements.topUpCreditsRemaining.toLocaleString()}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900">Provider details</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3 pt-0 md:grid-cols-2 xl:grid-cols-3">
          <BillingMetric label="Provider" value={provider?.provider ?? '—'} />
          <BillingMetric label="Customer ID" value={provider?.providerCustomerId ?? '—'} />
          <BillingMetric label="Plan subscription ID" value={provider?.providerSubscriptionId ?? '—'} />
          <BillingMetric label="Variant ID" value={provider?.providerVariantId ?? '—'} />
          <BillingMetric
            label="Status"
            value={formatSubscriptionStatusLabel(provider?.subscriptionStatus ?? plan.status)}
          />
          <BillingMetric
            label="Cancel at period end"
            value={provider?.cancelAtPeriodEnd ? 'Yes' : 'No'}
          />
          <BillingMetric
            label="Period start"
            value={formatUsagePeriodDate(provider?.currentPeriodStart ?? plan.currentPeriodStart)}
          />
          <BillingMetric
            label="Period end"
            value={formatUsagePeriodDate(provider?.currentPeriodEnd ?? plan.currentPeriodEnd)}
          />
        </CardBody>
      </Card>

      <ReadOnlyTable
        title="Add-ons"
        empty="No add-on rows for this workspace."
        headers={['Add-on', 'Bot', 'Status', 'Subscription ID', 'Order ID', 'Period']}
        rows={(support?.addons ?? []).map((row) => [
          row.addonKey,
          row.targetBotId ?? '—',
          row.status,
          row.providerSubscriptionId ?? '—',
          row.providerOrderId ?? '—',
          row.currentPeriodStart && row.currentPeriodEnd
            ? `${formatUsagePeriodDate(row.currentPeriodStart)} – ${formatUsagePeriodDate(row.currentPeriodEnd)}`
            : '—',
        ])}
      />

      <ReadOnlyTable
        title="Credit top-ups"
        empty="No credit top-up purchases."
        headers={['Purchased', 'Remaining', 'Expires', 'Order ID', 'Created']}
        rows={(support?.topUps ?? []).map((row) => [
          row.creditsPurchased.toLocaleString(),
          row.creditsRemaining.toLocaleString(),
          formatUsagePeriodDate(row.expiresAt),
          row.providerOrderId,
          formatAdminDate(row.createdAt),
        ])}
      />

      <WebhookEventsTable
        events={support?.webhookEvents ?? []}
        replayingEventId={replayingEventId}
        onReplay={(eventId) => void handleReplay(eventId)}
      />

      {usage.trainedKnowledge.perBot.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">Trained knowledge by agent</CardTitle>
            <CardDescription>{usage.trainedKnowledge.note}</CardDescription>
          </CardHeader>
          <CardBody className="overflow-x-auto pt-0">
            <table className="w-full min-w-[28rem] border-collapse text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-slate-100 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Agent</th>
                  <th className="px-2 py-2 text-right">Used</th>
                  <th className="px-2 py-2 text-right">Limit</th>
                </tr>
              </thead>
              <tbody>
                {usage.trainedKnowledge.perBot.map((row) => (
                  <tr key={row.botId} className="border-b border-slate-50 last:border-0">
                    <td className="px-2 py-2 font-medium text-slate-900">{row.botName}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">{row.usedMb} MB</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">{row.maxMb} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      <Card className="border-slate-200/90 bg-slate-50/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900">Admin metadata</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3 pt-0 md:grid-cols-2 xl:grid-cols-3">
          <BillingMetric label="Workspace" value={admin.workspaceName} />
          <BillingMetric label="Owner email" value={admin.workspaceOwnerEmail || '—'} />
          <BillingMetric label="Subscription row" value={admin.subscriptionId || 'Free (no row)'} />
          <BillingMetric label="Subscription created" value={formatAdminDate(admin.subscriptionCreatedAt)} />
          <BillingMetric label="Subscription updated" value={formatAdminDate(admin.subscriptionUpdatedAt)} />
          <BillingMetric
            label="Usage ledger rows"
            value={admin.usageLedgerCount == null ? '—' : admin.usageLedgerCount.toLocaleString()}
          />
        </CardBody>
      </Card>
    </div>
  );
}
