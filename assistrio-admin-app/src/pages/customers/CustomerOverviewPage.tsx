import { Link, useOutletContext } from 'react-router-dom';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatAdminDateTime } from '@/lib/formatAdminDate';
import type { CustomerDetailOutletContext } from './CustomerDetailLayout';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 m-0 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

export function CustomerOverviewPage() {
  const { customer } = useOutletContext<CustomerDetailOutletContext>();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Workspaces" value={customer.workspaceCount} />
        <StatCard label="Bots" value={customer.botCount} />
        <StatCard label="Published bots" value={customer.publishedBotCount} />
        <StatCard label="Draft bots" value={customer.draftBotCount} />
      </div>

      <p className="m-0 text-[0.8125rem] text-slate-500">
        <Link
          to={`/customers/${customer.id}/analytics`}
          className="font-medium text-[var(--color-teal-700)] hover:underline"
        >
          Customer analytics
        </Link>
        {' · '}
        <Link
          to={`/customers/${customer.id}/bots`}
          className="font-medium text-[var(--color-teal-700)] hover:underline"
        >
          View bots
        </Link>
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Name</p>
            <p className="mt-1 m-0 text-sm text-slate-900">{customer.name}</p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Email</p>
            <p className="mt-1 m-0 text-sm text-slate-900">{customer.email}</p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Created</p>
            <p className="mt-1 m-0 text-sm text-slate-700">{formatAdminDateTime(customer.createdAt)}</p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Last active</p>
            <p className="mt-1 m-0 text-sm text-slate-700">{formatAdminDateTime(customer.lastActiveAt)}</p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Customer ID</p>
            <p className="mt-1 m-0 font-mono text-xs text-slate-600">{customer.id}</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
