import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Search } from 'lucide-react';
import { getAdminBots } from '@/api/adminApi';
import type { AdminBotListItem } from '@/api/types';
import { AdminBotCard } from '@/components/AdminBotCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { DataPageLayout } from '@/layout/workspace-layout';

type StatusFilter = 'all' | 'draft' | 'published';

export function BotsListPage() {
  const [bots, setBots] = useState<AdminBotListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const res = await getAdminBots({
      status: statusFilter === 'all' ? undefined : statusFilter,
    });
    if (res.ok) setBots(res.data);
    else setError(res.error);
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!bots) return [];
    const q = search.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter((b) => {
      const hay = [b.name, b.slug, b.shortDescription, b.category, b._id, b.workspaceId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bots, search]);

  const count = filtered.length;

  return (
    <DataPageLayout
      title="Bots"
      description="All workspace bots across the platform. Search and filter locally until server-side pagination is added."
      containerSize="full"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by name, slug, or id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search bots"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          className="mb-5 flex flex-col gap-3 rounded-[0.625rem] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-[0.85rem] text-[0.875rem] text-[var(--color-danger-text-emphasis)] sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>{error}</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {bots === null && !error ? (
        <p className="text-sm text-slate-500">Loading bots…</p>
      ) : null}

      {!error && bots && count === 0 ? (
        <div
          className="rounded-2xl bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]"
          style={{ border: '1px dashed var(--border-soft)' }}
        >
          <div className="mb-4 flex justify-center text-slate-300">
            <Bot size={44} strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 mt-0 text-[1.125rem] font-semibold tracking-tight text-slate-900">No bots found</h2>
          <p className="mx-auto max-w-[28rem] text-[0.9375rem] leading-[1.55] text-slate-400">
            {search.trim() ? 'Try a different search or clear filters.' : 'No bots match the current status filter.'}
          </p>
        </div>
      ) : null}

      {bots && count > 0 ? (
        <section aria-label="All bots">
          <div className="mb-5 flex justify-end">
            <span className="text-[0.8125rem] font-semibold tabular-nums text-slate-500">
              {count} {count === 1 ? 'bot' : 'bots'}
              {search.trim() && bots.length !== count ? ` (of ${bots.length})` : ''}
            </span>
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((bot) => (
              <li key={bot._id}>
                <AdminBotCard bot={bot} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </DataPageLayout>
  );
}
