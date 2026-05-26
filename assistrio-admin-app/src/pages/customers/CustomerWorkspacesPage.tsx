import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useOutletContext, useParams } from 'react-router-dom';
import { getAdminCustomerWorkspaces } from '@/api/adminApi';
import type { AdminCustomerWorkspace } from '@/api/types';
import { Button, Card, CardBody } from '@/components/ui';
import { formatAdminDate } from '@/lib/formatAdminDate';
import { AdminWorkspaceBillingSection } from './AdminWorkspaceBillingSection';
import {
  formatAiCreditsUsageLabel,
  formatPlanBadgeLabel,
  formatSubscriptionStatusLabel,
} from './adminBillingDisplay';
import type { CustomerDetailOutletContext } from './CustomerDetailLayout';

function PlanBadge(props: { workspace: AdminCustomerWorkspace }) {
  const label = formatPlanBadgeLabel(props.workspace.planName, props.workspace.planKey);
  const isFree = (props.workspace.planKey ?? 'free') === 'free';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${
        isFree ? 'bg-slate-100 text-slate-700' : 'bg-teal-50 text-teal-800 ring-1 ring-teal-100'
      }`}
    >
      {label}
    </span>
  );
}

function StatusBadge(props: { status: string | undefined }) {
  const label = formatSubscriptionStatusLabel(props.status);
  const normalized = String(props.status ?? 'free').toLowerCase();
  const tone =
    normalized === 'active' || normalized === 'trialing'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
      : normalized === 'past_due' || normalized === 'unpaid'
        ? 'bg-amber-50 text-amber-900 ring-amber-100'
        : 'bg-slate-100 text-slate-700 ring-slate-200/80';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ring-1 ${tone}`}>
      {label}
    </span>
  );
}

export function CustomerWorkspacesPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { customer } = useOutletContext<CustomerDetailOutletContext>();
  const [workspaces, setWorkspaces] = useState<AdminCustomerWorkspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null);

  const loadWorkspaces = () => {
    if (!customerId) return;
    setLoading(true);
    void getAdminCustomerWorkspaces(customerId).then((res) => {
      setLoading(false);
      if (res.ok) {
        setWorkspaces(res.data.workspaces);
        setError(null);
        return;
      }
      setWorkspaces(null);
      setError(res.error);
    });
  };

  useEffect(() => {
    loadWorkspaces();
  }, [customerId]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading workspaces…</p>;
  }

  if (error) {
    return (
      <Card className="border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-sm text-[var(--color-danger-text)]" role="alert">
            {error}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={loadWorkspaces}>
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (!workspaces?.length) {
    return (
      <Card>
        <CardBody>
          <p className="m-0 text-sm text-slate-500">
            {customer.name} is not a member of any workspace yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[52rem] border-collapse text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
            <th className="w-8 px-2 py-3" aria-hidden />
            <th className="px-4 py-3">Workspace</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">AI credits</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3 text-right">Members</th>
            <th className="px-4 py-3 text-right">Bots</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((ws) => {
            const expanded = expandedWorkspaceId === ws.id;
            return (
              <Fragment key={ws.id}>
                <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className="inline-flex rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-expanded={expanded}
                      aria-label={expanded ? `Hide billing for ${ws.name}` : `Show billing for ${ws.name}`}
                      onClick={() => setExpandedWorkspaceId(expanded ? null : ws.id)}
                    >
                      {expanded ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{ws.name}</td>
                  <td className="px-4 py-3">
                    <PlanBadge workspace={ws} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ws.subscriptionStatus} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {formatAiCreditsUsageLabel(ws.aiCreditsUsedThisPeriod, ws.monthlyAiCredits)}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{ws.role ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {ws.currentMembers ?? ws.memberCount ?? '—'}
                    {ws.memberLimit != null ? ` / ${ws.memberLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {ws.currentBots ?? ws.botCount}
                    {ws.botLimit != null ? ` / ${ws.botLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatAdminDate(ws.createdAt)}</td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <td colSpan={9} className="px-4 py-4">
                      <AdminWorkspaceBillingSection workspaceId={ws.id} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
