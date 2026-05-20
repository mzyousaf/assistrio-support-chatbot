import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAdminCustomerBots } from '@/api/adminApi';
import type { AdminCustomerBot } from '@/api/types';
import { BotStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { formatAdminDate } from '@/lib/formatAdminDate';
import { AdminBotAnalyticsLinks } from '@/pages/analytics/AdminAnalyticsShared';

export function CustomerBotsPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [bots, setBots] = useState<AdminCustomerBot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    void getAdminCustomerBots(customerId).then((res) => {
      setLoading(false);
      if (res.ok) {
        setBots(res.data.bots);
        setError(null);
        return;
      }
      setBots(null);
      setError(res.error);
    });
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading bots…</p>;
  }

  if (error) {
    return (
      <div
        className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)] sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <span>{error}</span>
        <Button type="button" variant="secondary" size="sm" onClick={() => load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!bots?.length) {
    return (
      <Card>
        <CardBody>
          <p className="m-0 text-sm text-slate-500">No bots are linked to this customer.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[48rem] border-collapse text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Bot</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Visibility</th>
            <th className="px-4 py-3">Workspace</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {bots.map((bot) => (
            <tr key={bot.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="m-0 font-medium text-slate-900">{bot.name}</p>
                {bot.description ? (
                  <p className="mt-0.5 m-0 line-clamp-1 text-xs text-slate-500">{bot.description}</p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <BotStatusBadge status={bot.status} />
              </td>
              <td className="px-4 py-3 capitalize text-slate-600">{bot.visibility ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{bot.workspaceName ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{formatAdminDate(bot.createdAt)}</td>
              <td className="px-4 py-3 text-slate-600">{formatAdminDate(bot.updatedAt)}</td>
              <td className="px-4 py-3 text-right">
                <AdminBotAnalyticsLinks botId={bot.id} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
