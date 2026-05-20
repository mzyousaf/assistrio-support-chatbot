import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminAnalyticsOverview } from '@/api/adminAnalyticsApi';
import type { AdminAnalyticsOverviewResponse } from '@/api/types';
import { DataPageLayout } from '@/layout/workspace-layout';
import {
  ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS,
  buildAdminPlatformAnalyticsDateParams,
  type AdminPlatformAnalyticsDateState,
} from './adminPlatformAnalyticsDate';
import {
  AdminAnalyticsCaveats,
  AdminAnalyticsDateRangeControl,
  AdminAnalyticsError,
  AdminAnalyticsLoading,
  AdminAnalyticsMetricCard,
} from './AdminAnalyticsShared';

export function AdminAnalyticsOverviewPage() {
  const [dateState, setDateState] = useState<AdminPlatformAnalyticsDateState>(
    ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS,
  );
  const [overview, setOverview] = useState<AdminAnalyticsOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const dateParams = useMemo(() => buildAdminPlatformAnalyticsDateParams(dateState), [dateState]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ovRes = await getAdminAnalyticsOverview(dateParams);
    if (!ovRes.ok) {
      setError(ovRes.error);
      setOverview(null);
      setLoading(false);
      return;
    }
    setOverview(ovRes.data);
    setLoading(false);
  }, [dateParams]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DataPageLayout
      embedded
      title="Platform analytics"
      description="Marketing funnel and visitor activity for Assistrio-owned surfaces. Customer tenant bots are under Customers → Analytics."
      containerSize="full"
      actions={
        <AdminAnalyticsDateRangeControl
          value={dateState}
          onChange={setDateState}
          rangeLabel={overview?.range.label ?? null}
        />
      }
    >
      {error ? <AdminAnalyticsError message={error} onRetry={() => void load()} /> : null}
      {loading && !error ? <AdminAnalyticsLoading /> : null}

      {!loading && !error && overview ? (
        <div className="flex flex-col gap-8">
          <section aria-label="Marketing funnel">
            <h2 className="m-0 mb-3 text-[1rem] font-semibold text-slate-900">Marketing funnel</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminAnalyticsMetricCard
                label="Visitor events"
                value={overview.overview.totalVisitorEvents}
                hint="Anonymous track events"
              />
              <AdminAnalyticsMetricCard label="Page views" value={overview.overview.pageViews} />
              <AdminAnalyticsMetricCard label="CTA clicks" value={overview.overview.ctaClicks} />
              <AdminAnalyticsMetricCard label="Demo opened" value={overview.overview.demoOpened} />
              <AdminAnalyticsMetricCard
                label="Trial create started"
                value={overview.overview.legacyVisitorEventCounts.trial_create_started}
              />
              <AdminAnalyticsMetricCard
                label="Trial create succeeded"
                value={overview.overview.legacyVisitorEventCounts.trial_create_succeeded}
              />
            </div>
            <p className="mt-3 text-[0.8125rem] text-slate-500">
              <Link
                to="/insights/marketing-visitors"
                className="font-medium text-[var(--color-teal-700)] hover:underline"
              >
                Marketing visitors
              </Link>
              {' · '}
              <Link to="/admin-bots" className="font-medium text-[var(--color-teal-700)] hover:underline">
                Admin bots
              </Link>
            </p>
          </section>

          <details className="rounded-[0.625rem] border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-[0.8125rem] text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">
              Global bot activity (all tenants — not shown on this dashboard)
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AdminAnalyticsMetricCard
                label="All-bot conversations"
                value={overview.messages.totalConversations}
                hint="Every bot in the platform"
              />
              <AdminAnalyticsMetricCard label="All-bot messages" value={overview.messages.totalMessages} />
              <AdminAnalyticsMetricCard
                label="All-bot leads"
                value={overview.leads.conversationsWithCapturedLeads}
              />
              <AdminAnalyticsMetricCard
                label="Published bots (all)"
                value={overview.bots.publishedBotsCount}
                hint="Point-in-time, not range-scoped"
              />
            </div>
            <p className="mb-0 mt-2 text-[0.75rem] text-slate-500">
              For customer-owned bots, open a customer record and use Customer analytics.
            </p>
          </details>

          <AdminAnalyticsCaveats items={overview.caveats} />
        </div>
      ) : null}
    </DataPageLayout>
  );
}
