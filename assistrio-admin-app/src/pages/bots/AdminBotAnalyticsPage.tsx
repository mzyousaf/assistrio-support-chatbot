import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getAdminAnalyticsBotDetail } from '@/api/adminAnalyticsApi';
import type { AdminAnalyticsBotDetailResponse } from '@/api/types';
import { BotStatusBadge } from '@/components/StatusBadge';
import { DataPageLayout } from '@/layout/workspace-layout';
import { formatAdminDateTime } from '@/lib/formatAdminDate';
import {
  ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS,
  buildAdminPlatformAnalyticsDateParams,
  type AdminPlatformAnalyticsDateState,
} from '@/pages/analytics/adminPlatformAnalyticsDate';
import {
  AdminAnalyticsCaveats,
  AdminAnalyticsDateRangeControl,
  AdminAnalyticsError,
  AdminAnalyticsLoading,
  AdminAnalyticsMetricCard,
  AdminBotAnalyticsLinks,
  PlatformBotTypeBadge,
} from '@/pages/analytics/AdminAnalyticsShared';

export function AdminBotAnalyticsPage() {
  const { id: botId = '' } = useParams<{ id: string }>();
  const [dateState, setDateState] = useState<AdminPlatformAnalyticsDateState>(
    ADMIN_PLATFORM_ANALYTICS_DATE_DEFAULTS,
  );
  const [data, setData] = useState<AdminAnalyticsBotDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const dateParams = useMemo(() => buildAdminPlatformAnalyticsDateParams(dateState), [dateState]);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    const res = await getAdminAnalyticsBotDetail(botId, dateParams);
    if (!res.ok) {
      setError(res.error);
      setData(null);
    } else {
      setData(res.data);
    }
    setLoading(false);
  }, [botId, dateParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const lastActivity =
    data?.activity.lastConversationActivityAtInRange ??
    data?.activity.lastMessageAtInRange ??
    data?.activity.lastConversationCreatedAtInRange ??
    null;

  return (
    <DataPageLayout
      embedded
      containerSize="full"
      title={data?.bot.name ? `Bot analytics · ${data.bot.name}` : 'Bot analytics'}
      description={
        data
          ? `${data.bot.slug} · ${data.range.label}`
          : 'Per-bot metrics for the selected date range.'
      }
      actions={
        <AdminAnalyticsDateRangeControl
          value={dateState}
          onChange={setDateState}
          rangeLabel={data?.range.label ?? null}
        />
      }
    >
      <div className="mb-6">
        <Link
          to={`/bots/${botId}`}
          className="inline-flex items-center gap-1.5 rounded-[var(--ui-radius)] px-2 py-1 text-[0.8125rem] font-medium text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to bot
        </Link>
      </div>

      {error ? <AdminAnalyticsError message={error} onRetry={() => void load()} /> : null}
      {loading && !error ? <AdminAnalyticsLoading label="Loading bot analytics…" /> : null}

      {!loading && !error && data ? (
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <BotStatusBadge status={data.bot.status} />
            <PlatformBotTypeBadge
              isPlatformBot={data.bot.isPlatformBot}
              platformBotType={data.bot.platformBotType}
              agentsPackAgent={data.bot.agentsPackAgent}
            />
            <AdminBotAnalyticsLinks botId={data.bot.botId} showAnalyticsLink={false} />
          </div>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminAnalyticsMetricCard label="Conversations" value={data.metrics.conversationCount} />
            <AdminAnalyticsMetricCard label="Messages" value={data.metrics.messageCount} />
            <AdminAnalyticsMetricCard
              label="Leads captured"
              value={data.metrics.conversationsWithCapturedLeads}
            />
            <AdminAnalyticsMetricCard
              label="Last activity in range"
              value={lastActivity}
              displayValue={lastActivity ? formatAdminDateTime(lastActivity) : '—'}
              hint="Latest message or conversation touch"
            />
          </section>

          <AdminAnalyticsCaveats items={data.caveats} />
        </div>
      ) : null}
    </DataPageLayout>
  );
}
