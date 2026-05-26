import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getAdminWorkspaceBillingSummary } from '@/api/adminApi';
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

export function AdminWorkspaceBillingSection(props: { workspaceId: string }) {
  const { workspaceId } = props;
  const [summary, setSummary] = useState<AdminWorkspaceBillingSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);

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

  const { plan, entitlements, usage, admin, addonCatalog } = summary;
  const activeAddonNames = entitlements.activeAddons.length
    ? entitlements.activeAddons.join(', ')
    : 'None';

  return (
    <div className="space-y-4">
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
          <BillingMetric
            label="Agents"
            value={`${usage.bots.current} / ${usage.bots.limit}`}
          />
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
          <BillingMetric label="Add-ons" value={activeAddonNames} />
          <BillingMetric
            label="Top-up credits"
            value={entitlements.topUpCreditsRemaining.toLocaleString()}
          />
        </CardBody>
      </Card>

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
          <BillingMetric
            label="Add-on catalog"
            value={`${addonCatalog.length} listed · checkout unavailable`}
          />
        </CardBody>
      </Card>
    </div>
  );
}
