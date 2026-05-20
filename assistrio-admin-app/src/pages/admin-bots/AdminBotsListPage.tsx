import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Plus } from 'lucide-react';
import { deleteAdminPlatformBot, getAdminPlatformBots } from '@/api/adminApi';
import type { AdminPlatformBotListItem, PlatformBotType } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { DataPageLayout } from '@/layout/workspace-layout';
import { formatAdminDateTime } from '@/lib/formatAdminDate';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'draft' | 'published';
type TypeFilter = 'all' | PlatformBotType;

function statusPill(status: string) {
  if (status === 'published') {
    return 'bg-emerald-50 text-emerald-700';
  }
  return 'bg-amber-50 text-amber-700';
}

export function AdminBotsListPage() {
  const [bots, setBots] = useState<AdminPlatformBotListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAdminPlatformBots({
      status: statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
    });
    setLoading(false);
    if (res.ok) setBots(res.data);
    else {
      setBots(null);
      setError(res.error);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(bot: AdminPlatformBotListItem) {
    const ok = window.confirm(`Delete platform bot "${bot.name}"? This cannot be undone.`);
    if (!ok) return;
    setDeletingId(bot._id);
    const res = await deleteAdminPlatformBot(bot._id);
    setDeletingId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void load();
  }

  return (
    <DataPageLayout
      embedded
      containerSize="full"
      title="Admin bots"
      description="Assistrio-owned platform bots for landing demos, showcase, support, and internal use."
      actions={
        <Link to="/admin-bots/new" className="no-underline">
          <Button type="button" variant="primary" size="sm">
            <Plus size={16} className="mr-1.5" aria-hidden />
            Create bot
          </Button>
        </Link>
      }
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
            Type
          </span>
          {(
            [
              ['all', 'All types'],
              ['landing_demo', 'Landing demo'],
              ['showcase', 'Showcase'],
              ['support', 'Support'],
              ['internal', 'Internal'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 text-[0.8125rem] font-medium transition-colors',
                typeFilter === value
                  ? 'border-primary bg-[var(--teal-50)] text-[var(--teal-800)]'
                  : 'border-[var(--ui-border)] bg-white text-slate-600 hover:bg-[var(--hover-soft)]',
              )}
              onClick={() => setTypeFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
            Status
          </span>
          {(['all', 'draft', 'published'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 text-[0.8125rem] font-medium transition-colors',
                statusFilter === s
                  ? 'border-primary bg-[var(--teal-50)] text-[var(--teal-800)]'
                  : 'border-[var(--ui-border)] bg-white text-slate-600 hover:bg-[var(--hover-soft)]',
              )}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s === 'draft' ? 'Draft' : 'Published'}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div
          className="mb-5 rounded-[0.625rem] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-[0.85rem] text-[0.875rem] text-[var(--color-danger-text-emphasis)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && !bots ? <p className="text-sm text-slate-500">Loading admin bots…</p> : null}

      {!loading && bots && bots.length === 0 ? (
        <div
          className="rounded-2xl bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]"
          style={{ border: '1px dashed var(--border-soft)' }}
        >
          <div className="mb-4 flex justify-center text-slate-300">
            <Bot size={44} strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 mt-0 text-[1.125rem] font-semibold tracking-tight text-slate-900">
            No admin bots yet
          </h2>
          <p className="mx-auto mb-6 max-w-[28rem] text-[0.9375rem] leading-[1.55] text-slate-400">
            Create a platform bot for landing demos, showcase pages, or Assistrio support.
          </p>
          <Link to="/admin-bots/new" className="no-underline">
            <Button type="button" variant="primary">
              Create bot
            </Button>
          </Link>
        </div>
      ) : null}

      {bots && bots.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[48rem] border-collapse text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr key={bot._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{bot.name}</td>
                  <td className="px-4 py-3 text-slate-600">{bot.platformBotTypeLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold capitalize',
                        statusPill(bot.status),
                      )}
                    >
                      {bot.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{bot.visibility}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {formatAdminDateTime(bot.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {formatAdminDateTime(bot.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-3">
                      <Link
                        to={`/bots/${bot._id}/analytics`}
                        className="font-semibold text-slate-600 no-underline hover:text-slate-900 hover:underline"
                      >
                        Analytics
                      </Link>
                      <Link
                        to={`/admin-bots/${bot._id}`}
                        className="font-semibold text-primary no-underline hover:text-[var(--teal-800)] hover:underline"
                      >
                        Manage
                      </Link>
                      <Link
                        to={`/bots/${bot._id}`}
                        className="font-semibold text-slate-600 no-underline hover:text-slate-900 hover:underline"
                      >
                        Editor
                      </Link>
                      <button
                        type="button"
                        className="cursor-pointer border-none bg-transparent p-0 font-semibold text-[var(--color-danger-text)] hover:underline disabled:opacity-50"
                        disabled={deletingId === bot._id}
                        onClick={() => void handleDelete(bot)}
                      >
                        {deletingId === bot._id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </DataPageLayout>
  );
}
