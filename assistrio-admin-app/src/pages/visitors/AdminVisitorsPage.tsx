import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getAdminVisitors } from '@/api/adminVisitorsApi';
import type { AdminVisitorListItem } from '@/api/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DataPageLayout } from '@/layout/workspace-layout';
import { formatAdminDateTime } from '@/lib/formatAdminDate';
import {
  ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS,
  type AdminPlatformAnalyticsDateState,
} from '@/pages/analytics/adminPlatformAnalyticsDate';
import {
  AdminAnalyticsDateRangeControl,
  AdminAnalyticsEmpty,
  AdminAnalyticsError,
  AdminAnalyticsLoading,
  AdminAnalyticsMetricCard,
  AdminAnalyticsTableWrap,
  AdminAnalyticsTd,
  AdminAnalyticsTh,
} from '@/pages/analytics/AdminAnalyticsShared';
import {
  computeVisitorsListSummary,
  filterVisitorsByDateRange,
  filterVisitorsBySearch,
  shortVisitorId,
  visitorHasContact,
  visitorIsReturning,
  visitorTypeLabel,
} from './adminVisitorsUtils';

export function AdminVisitorsPage() {
  const [rows, setRows] = useState<AdminVisitorListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateState, setDateState] = useState<AdminPlatformAnalyticsDateState>(
    ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS,
  );
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAdminVisitors();
    if (!res.ok) {
      setError(res.error);
      setRows(null);
    } else {
      setRows(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    let list = filterVisitorsByDateRange(rows, dateState);
    list = filterVisitorsBySearch(list, search);
    if (typeFilter !== 'all') {
      list = list.filter((v) => (v.visitorType ?? 'marketing') === typeFilter);
    }
    return [...list].sort((a, b) => {
      const ta = new Date(String(a.lastSeenAt ?? a.createdAt ?? 0)).getTime();
      const tb = new Date(String(b.lastSeenAt ?? b.createdAt ?? 0)).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [rows, dateState, search, typeFilter]);

  const summary = useMemo(() => computeVisitorsListSummary(filtered), [filtered]);

  return (
    <DataPageLayout
      embedded
      title="Marketing visitors"
      description="Marketing and funnel identities from site analytics tracking. Filters below apply client-side — the API returns all visitor rows."
      containerSize="full"
      actions={
        <AdminAnalyticsDateRangeControl
          value={dateState}
          onChange={setDateState}
          rangeLabel="Last activity in range"
        />
      }
    >
      {!loading && rows ? (
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
          <AdminAnalyticsMetricCard label="Visitors (filtered)" value={summary.total} />
          <AdminAnalyticsMetricCard label="With contact info" value={summary.withContact} hint="Name, email, or phone on record" />
          <AdminAnalyticsMetricCard label="Returning" value={summary.returning} hint="Last seen >1h after first seen" />
          <AdminAnalyticsMetricCard
            label="Loaded from API"
            value={rows.length}
            hint="Total rows before client filters"
          />
        </section>
      ) : null}

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search visitor id, name, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search visitors"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem]">
            <label className="mb-1 block text-[0.75rem] font-medium text-slate-600" htmlFor="visitor-type-filter">
              Type
            </label>
            <Select
              id="visitor-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              triggerClassName="h-9 w-full min-w-[10rem]"
            >
              <option value="all">All types</option>
              <option value="marketing">Marketing</option>
              <option value="platform">Platform (legacy)</option>
            </Select>
          </div>
          {filtered.length > 0 ? (
            <span className="pb-2 text-[0.8125rem] font-semibold tabular-nums text-slate-500">
              {filtered.length} shown
            </span>
          ) : null}
        </div>
      </div>

      {error ? <AdminAnalyticsError message={error} onRetry={() => void load()} /> : null}
      {loading && !error ? <AdminAnalyticsLoading label="Loading visitors…" /> : null}

      {!loading && !error && filtered.length === 0 ? (
        <AdminAnalyticsEmpty
          title="No visitors match"
          description={
            rows?.length
              ? 'Try clearing search or widening the date range.'
              : 'No marketing visitors have been recorded yet.'
          }
        />
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <>
          <AdminAnalyticsTableWrap>
            <thead>
              <tr>
                <AdminAnalyticsTh>Visitor</AdminAnalyticsTh>
                <AdminAnalyticsTh>First seen</AdminAnalyticsTh>
                <AdminAnalyticsTh>Last seen</AdminAnalyticsTh>
                <AdminAnalyticsTh>Type</AdminAnalyticsTh>
                <AdminAnalyticsTh>Contact</AdminAnalyticsTh>
                <AdminAnalyticsTh className="text-right">Showcase msgs</AdminAnalyticsTh>
                <AdminAnalyticsTh>Actions</AdminAnalyticsTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.visitorId} className="hover:bg-slate-50/60">
                  <AdminAnalyticsTd>
                    <div className="font-medium text-slate-900" title={row.visitorId}>
                      {row.name?.trim() || shortVisitorId(row.visitorId)}
                    </div>
                    {row.name?.trim() ? (
                      <div className="font-mono text-[0.75rem] text-slate-500">{shortVisitorId(row.visitorId)}</div>
                    ) : null}
                  </AdminAnalyticsTd>
                  <AdminAnalyticsTd className="text-[0.8125rem] text-slate-600">
                    {formatAdminDateTime(
                      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ''),
                    )}
                  </AdminAnalyticsTd>
                  <AdminAnalyticsTd className="text-[0.8125rem] text-slate-600">
                    {formatAdminDateTime(
                      row.lastSeenAt instanceof Date ? row.lastSeenAt.toISOString() : String(row.lastSeenAt ?? ''),
                    )}
                  </AdminAnalyticsTd>
                  <AdminAnalyticsTd>
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.6875rem] font-medium text-slate-700">
                      {visitorTypeLabel(String(row.visitorType))}
                    </span>
                  </AdminAnalyticsTd>
                  <AdminAnalyticsTd>
                    {visitorHasContact(row) ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-700">
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {visitorIsReturning(row) ? (
                      <span className="ml-1 inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[0.6875rem] font-medium text-teal-800">
                        Returning
                      </span>
                    ) : null}
                  </AdminAnalyticsTd>
                  <AdminAnalyticsTd className="text-right tabular-nums text-slate-700">
                    {row.showcaseMessageCount ?? 0}
                  </AdminAnalyticsTd>
                  <AdminAnalyticsTd>
                    <Link
                      to={`/insights/marketing-visitors/${encodeURIComponent(row.visitorId)}`}
                      className="text-[0.8125rem] font-medium text-[var(--color-teal-700)] hover:underline"
                    >
                      View details
                    </Link>
                  </AdminAnalyticsTd>
                </tr>
              ))}
            </tbody>
          </AdminAnalyticsTableWrap>
          <p className="mt-4 text-[0.75rem] text-slate-400">
            {/* TODO: per-visitor page views, source/referrer, country, device — not on list API. */}
            Page views, referrer, UTM, and geo are not included in GET /api/admin/visitors (see event timeline on detail).
          </p>
        </>
      ) : null}
    </DataPageLayout>
  );
}
