import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { getAdminCustomerWorkspaces } from '@/api/adminApi';
import type { AdminCustomerWorkspace } from '@/api/types';
import { Card, CardBody } from '@/components/ui/Card';
import { formatAdminDate } from '@/lib/formatAdminDate';
import type { CustomerDetailOutletContext } from './CustomerDetailLayout';

export function CustomerWorkspacesPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { customer } = useOutletContext<CustomerDetailOutletContext>();
  const [workspaces, setWorkspaces] = useState<AdminCustomerWorkspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [customerId]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading workspaces…</p>;
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]"
        role="alert"
      >
        {error}
      </div>
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
      <table className="w-full min-w-[40rem] border-collapse text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Workspace</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3 text-right">Members</th>
            <th className="px-4 py-3 text-right">Bots</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((ws) => (
            <tr key={ws.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-900">{ws.name}</td>
              <td className="px-4 py-3 capitalize text-slate-600">{ws.role ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{ws.memberCount ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{ws.botCount}</td>
              <td className="px-4 py-3 text-slate-600">{formatAdminDate(ws.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
