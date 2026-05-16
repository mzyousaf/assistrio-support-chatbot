import { useCallback, useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { getCustomerBotLeadsAnalytics } from '@/api/customerApi';
import type { CustomerLeadsAnalyticsResponse } from '@/api/types';
import { safeClientString } from '@/lib/safeClientString';
import { LEADS_ANALYTICS_DEFAULTS, buildLeadsAnalyticsApiParams, type LeadsAnalyticsUiState } from '@/lib/leadsAnalyticsQuery';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { useBotWorkspace } from '../../BotWorkspaceContext';
import { AnalyticsChartCard } from '../chats/AnalyticsChartCard';
import { AnalyticsErrorState } from '../shared/AnalyticsErrorState';
import { AnalyticsPageHeader } from '../shared/AnalyticsPageHeader';
import { LeadsConversionChart } from './LeadsConversionChart';
import { LeadsEmptyState } from './LeadsEmptyState';
import { LeadsFieldCaptureChart } from './LeadsFieldCaptureChart';
import { LeadsAnalyticsFilterBar } from '../shared/AnalyticsInsightsFilterBars';
import { LeadsLocationPanel } from './LeadsLocationPanel';
import { LeadsOverTimeChart } from './LeadsOverTimeChart';
import { LeadsPageSkeleton } from './LeadsPageSkeleton';
import { LeadsStartedFromChart } from './LeadsStartedFromChart';
import { LeadsSummaryCards } from './LeadsSummaryCards';

function hasLeadsAnalyticsSignal(data: CustomerLeadsAnalyticsResponse | null): boolean {
  if (!data) return false;
  return (data.summary.totalConversations ?? 0) > 0;
}

export function LeadsAnalyticsPage() {
  const { botId } = useBotWorkspace();
  const [ui, setUi] = useState<LeadsAnalyticsUiState>(() => ({ ...LEADS_ANALYTICS_DEFAULTS }));
  const [data, setData] = useState<CustomerLeadsAnalyticsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const params = useMemo(() => buildLeadsAnalyticsApiParams(ui), [ui]);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoadState('loading');
    setErrorMessage('');
    const res = await getCustomerBotLeadsAnalytics(botId, params);
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
  const empty = loadState === 'ok' && data && !hasLeadsAnalyticsSignal(data);

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader
          title="Leads"
          titleIcon={Target}
          subtitle="Measure capture rates, funnels by traffic source, and which fields visitors complete — without exposing private lead values."
          filters={<LeadsAnalyticsFilterBar state={ui} onChange={setUi} disabled={loadState === 'loading'} />}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/40 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            {showSkeleton ? <LeadsPageSkeleton /> : null}
            {showError ? <AnalyticsErrorState onRetry={() => void load()} detail={errorMessage} /> : null}

            {showBody && data ? (
              <>
                {empty ? (
                  <LeadsEmptyState />
                ) : (
                  <>
                    <LeadsSummaryCards summary={data.summary} />
                    <AnalyticsChartCard
                      title="Volume over time"
                      description="New conversations versus qualified leads (leads bucketed by capture time when available)."
                      bodyClassName="h-[min(360px,55vh)] min-h-[280px] w-full max-w-full"
                    >
                      <LeadsOverTimeChart points={data.timeSeries} granularity={data.range.granularity} />
                    </AnalyticsChartCard>
                    <AnalyticsChartCard
                      title="Conversion rate"
                      description="Share of conversations that resulted in a captured lead, by period."
                      bodyClassName="min-h-[240px] w-full max-w-full"
                    >
                      <LeadsConversionChart points={data.timeSeries} granularity={data.range.granularity} />
                    </AnalyticsChartCard>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <AnalyticsChartCard
                        title="By chat source"
                        description="Runtime versus preview surfaces — conversations and leads."
                        bodyClassName="min-h-[260px]"
                      >
                        <LeadsStartedFromChart rows={data.startedFromBreakdown} />
                      </AnalyticsChartCard>
                      <AnalyticsChartCard title="Location" description="Aggregated geography (no visitor PII).">
                        <LeadsLocationPanel
                          countries={data.locationBreakdown.countries}
                          cities={data.locationBreakdown.cities}
                        />
                      </AnalyticsChartCard>
                    </div>
                    <AnalyticsChartCard
                      title="Captured fields"
                      description="How often each field was filled (counts only — values are never shown here)."
                      bodyClassName="min-h-[200px]"
                    >
                      <LeadsFieldCaptureChart rows={data.fieldCaptureBreakdown} />
                    </AnalyticsChartCard>
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
