import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCustomerBotUsage } from '@/api/customerApi';
import type { CustomerUsageResponse } from '@/api/types';
import { safeClientString } from '@/lib/safeClientString';
import {
  USAGE_ANALYTICS_DEFAULTS,
  buildUsageAnalyticsApiParams,
  type UsageAnalyticsUiState,
} from '@/lib/usageAnalyticsQuery';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { AnalyticsPageHeader } from '@/pages/bot-workspace/analytics/shared/AnalyticsPageHeader';
import { AnalyticsChartCard } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartCard';
import { AnalyticsPageSkeleton } from '@/pages/bot-workspace/analytics/shared/AnalyticsPageSkeleton';
import { AnalyticsErrorState } from '@/pages/bot-workspace/analytics/shared/AnalyticsErrorState';
import { AnalyticsPageEmptyState } from '@/pages/bot-workspace/analytics/shared/AnalyticsPageEmptyState';
import { useBotWorkspace } from './BotWorkspaceContext';
import { UsageAnalyticsFilterBar } from '@/pages/bot-workspace/analytics/shared/AnalyticsInsightsFilterBars';
import { UsageSummaryCards } from './usage/UsageSummaryCards';
import { UsageCreditsOverTimeChart } from './usage/UsageCreditsOverTimeChart';
import { UsageMessagesMixChart } from './usage/UsageMessagesMixChart';
import { UsageTypeBreakdownChart } from './usage/UsageTypeBreakdownChart';
import { UsageVoiceDictationCard } from './usage/UsageVoiceDictationCard';
import { UsageBreakdownTable } from './usage/UsageBreakdownTable';
import { USAGE_DASHBOARD_COPY } from './usage/usageDashboardCopy';
import { Coins } from 'lucide-react';

function hasUsageSignal(data: CustomerUsageResponse | null): boolean {
  if (!data) return false;
  const s = data.summary;
  return (
    (s.totalMessages ?? 0) > 0 ||
    (s.totalUsageEvents ?? 0) > 0 ||
    (s.totalCreditsUsed ?? 0) > 0 ||
    (s.totalBillableCredits ?? 0) > 0 ||
    (s.totalNonBillableCredits ?? 0) > 0
  );
}

export function BotUsagePage() {
  const { botId } = useBotWorkspace();
  const [ui, setUi] = useState<UsageAnalyticsUiState>(() => ({ ...USAGE_ANALYTICS_DEFAULTS }));
  const [data, setData] = useState<CustomerUsageResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const params = useMemo(() => buildUsageAnalyticsApiParams(ui), [ui]);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoadState('loading');
    setErrorMessage('');
    const res = await getCustomerBotUsage(botId, params);
    if (!res.ok) {
      setData(null);
      setLoadState('error');
      setErrorMessage(safeClientString(res.error, 'Something went wrong.'));
      return;
    }
    setData(res.data);
    setLoadState('ok');
  }, [botId, params]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!botId) return null;

  const showSkeleton = loadState === 'loading' && !data;
  const showError = loadState === 'error';
  const showBody = data != null && !showError;
  const empty = loadState === 'ok' && data && !hasUsageSignal(data);

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader
          title={USAGE_DASHBOARD_COPY.title}
          subtitle={USAGE_DASHBOARD_COPY.subtitle}
          filters={<UsageAnalyticsFilterBar state={ui} onChange={setUi} disabled={loadState === 'loading'} />}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/40 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            {showSkeleton ? <AnalyticsPageSkeleton layout="knowledge" /> : null}
            {showError ? (
              <AnalyticsErrorState
                onRetry={() => void load()}
                detail={errorMessage}
                title={USAGE_DASHBOARD_COPY.errorTitle}
                description={USAGE_DASHBOARD_COPY.errorDescription}
              />
            ) : null}

            {showBody && data ? (
              <>
                {empty ? (
                  <AnalyticsPageEmptyState
                    Icon={Coins}
                    title={USAGE_DASHBOARD_COPY.emptyTitle}
                    hint={USAGE_DASHBOARD_COPY.emptyHint}
                  />
                ) : (
                  <>
                    <UsageSummaryCards summary={data.summary} />

                    <AnalyticsChartCard
                      title={USAGE_DASHBOARD_COPY.creditsOverTimeTitle}
                      description={USAGE_DASHBOARD_COPY.creditsOverTimeDescription}
                      bodyClassName="h-[min(360px,55vh)] min-h-[280px] w-full max-w-full"
                    >
                      <UsageCreditsOverTimeChart timeSeries={data.timeSeries} granularity={data.range.granularity} />
                    </AnalyticsChartCard>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <AnalyticsChartCard
                        title={USAGE_DASHBOARD_COPY.messagesOverTimeTitle}
                        description={USAGE_DASHBOARD_COPY.messagesOverTimeDescription}
                        bodyClassName="h-[min(360px,55vh)] min-h-[280px]"
                      >
                        <UsageMessagesMixChart timeSeries={data.timeSeries} granularity={data.range.granularity} />
                      </AnalyticsChartCard>
                      <AnalyticsChartCard
                        title={USAGE_DASHBOARD_COPY.usageTypeTitle}
                        description={USAGE_DASHBOARD_COPY.usageTypeDescription}
                        bodyClassName="h-[min(360px,55vh)] min-h-[280px]"
                      >
                        <UsageTypeBreakdownChart rows={data.usageTypeBreakdown} />
                      </AnalyticsChartCard>
                    </div>

                    <UsageVoiceDictationCard summary={data.dictationVoiceSummary} />

                    {data.usageTypeBreakdown.length > 0 ? <UsageBreakdownTable rows={data.usageTypeBreakdown} /> : null}
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceContentContainer>
  );
}
