import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { getAdminCustomerAnalyticsOverview } from '@/api/adminAnalyticsApi';
import type { AdminCustomerAnalyticsOverviewResponse } from '@/api/types';
import { BotStatusBadge } from '@/components/StatusBadge';
import { DataPageLayout } from '@/layout/workspace-layout';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { formatAdminDate } from '@/lib/formatAdminDate';
import {
  ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS,
  buildAdminPlatformAnalyticsDateParams,
  type AdminPlatformAnalyticsDateState,
} from '@/pages/analytics/adminPlatformAnalyticsDate';
import {
  AdminAnalyticsCaveats,
  AdminAnalyticsDateRangeControl,
  AdminAnalyticsEmpty,
  AdminAnalyticsError,
  AdminAnalyticsLoading,
  AdminAnalyticsMetricCard,
  AdminAnalyticsTableWrap,
  AdminAnalyticsTd,
  AdminAnalyticsTh,
  AdminBotAnalyticsLinks,
  PlatformBotTypeBadge,
} from '@/pages/analytics/AdminAnalyticsShared';
import type { CustomerDetailOutletContext } from './CustomerDetailLayout';

export function CustomerAnalyticsPage() {
  const { customerId = '' } = useParams<{ customerId: string }>();
  const { customer } = useOutletContext<CustomerDetailOutletContext>();
  const [dateState, setDateState] = useState<AdminPlatformAnalyticsDateState>(
    ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS,
  );
  const [data, setData] = useState<AdminCustomerAnalyticsOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const dateParams = useMemo(() => buildAdminPlatformAnalyticsDateParams(dateState), [dateState]);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    const res = await getAdminCustomerAnalyticsOverview(customerId, dateParams);
    if (!res.ok) {
      setError(res.error);
      setData(null);
    } else {
      setData(res.data);
    }
    setLoading(false);
  }, [customerId, dateParams]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DataPageLayout
      embedded
      title="Customer analytics"
      description={`Bots and activity for ${customer.name} in the selected date range.`}
      actions={
        <AdminAnalyticsDateRangeControl
          value={dateState}
          onChange={setDateState}
          rangeLabel={
            data?.range.from && data?.range.to
              ? `${formatAdminDate(data.range.from)} – ${formatAdminDate(data.range.to)}`
              : null
          }
        />
      }
    >
      {error ? <AdminAnalyticsError message={error} onRetry={() => void load()} /> : null}
      {loading && !error ? <AdminAnalyticsLoading label="Loading customer analytics…" /> : null}

      {!loading && !error && data ? (
        <div className="flex flex-col gap-8">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AdminAnalyticsMetricCard label="Bots" value={data.totals.botCount} />
            <AdminAnalyticsMetricCard label="Published" value={data.totals.publishedBotCount} />
            <AdminAnalyticsMetricCard label="Draft" value={data.totals.draftBotCount} />
            <AdminAnalyticsMetricCard label="Conversations" value={data.totals.conversationCount} />
            <AdminAnalyticsMetricCard label="Messages" value={data.totals.messageCount} />
            <AdminAnalyticsMetricCard
              label="Leads captured"
              value={data.totals.conversationsWithCapturedLeads}
            />
          </section>

          {data.bots.length > 0 ? (
            <section aria-label="Customer bots">
              <h2 className="m-0 mb-3 text-[1rem] font-semibold text-slate-900">Bots</h2>
              <AdminAnalyticsTableWrap>
                <thead>
                  <tr>
                    <AdminAnalyticsTh>Bot</AdminAnalyticsTh>
                    <AdminAnalyticsTh>Status</AdminAnalyticsTh>
                    <AdminAnalyticsTh className="text-right">Conversations</AdminAnalyticsTh>
                    <AdminAnalyticsTh className="text-right">Messages</AdminAnalyticsTh>
                    <AdminAnalyticsTh className="text-right">Leads</AdminAnalyticsTh>
                    <AdminAnalyticsTh>Actions</AdminAnalyticsTh>
                  </tr>
                </thead>
                <tbody>
                  {data.bots.map((row) => (
                    <tr key={row.botId} className="hover:bg-slate-50/60">
                      <AdminAnalyticsTd>
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <PlatformBotTypeBadge
                          isPlatformBot={row.isPlatformBot}
                          platformBotType={row.platformBotType}
                        />
                      </AdminAnalyticsTd>
                      <AdminAnalyticsTd>
                        <BotStatusBadge status={row.status} />
                      </AdminAnalyticsTd>
                      <AdminAnalyticsTd className="text-right tabular-nums">
                        {formatAnalyticsInteger(row.conversationCount)}
                      </AdminAnalyticsTd>
                      <AdminAnalyticsTd className="text-right tabular-nums">
                        {formatAnalyticsInteger(row.messageCount)}
                      </AdminAnalyticsTd>
                      <AdminAnalyticsTd className="text-right tabular-nums">
                        {formatAnalyticsInteger(row.conversationsWithCapturedLeads)}
                      </AdminAnalyticsTd>
                      <AdminAnalyticsTd>
                        <AdminBotAnalyticsLinks botId={row.botId} compact />
                      </AdminAnalyticsTd>
                    </tr>
                  ))}
                </tbody>
              </AdminAnalyticsTableWrap>
            </section>
          ) : (
            <AdminAnalyticsEmpty
              title="No bots"
              description="This customer has no accessible bots in the selected range."
            />
          )}

          <AdminAnalyticsCaveats items={data.caveats} />
        </div>
      ) : null}
    </DataPageLayout>
  );
}
