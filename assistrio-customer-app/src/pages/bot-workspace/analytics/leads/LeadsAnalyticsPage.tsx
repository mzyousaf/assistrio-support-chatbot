import { useCallback, useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { getCustomerBotLeadsAnalytics } from '@/api/customerApi';
import type { CustomerChatsAnalyticsCountryRow, CustomerLeadsAnalyticsResponse } from '@/api/types';
import { safeClientString } from '@/lib/safeClientString';
import { LEADS_ANALYTICS_DEFAULTS, buildLeadsAnalyticsApiParams, type LeadsAnalyticsUiState } from '@/lib/leadsAnalyticsQuery';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { useBotWorkspace } from '../../BotWorkspaceContext';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { AnalyticsErrorState } from '../shared/AnalyticsErrorState';
import { AnalyticsPageHeader } from '../shared/AnalyticsPageHeader';
import { LeadsAnalyticsFilterBar } from '../shared/AnalyticsInsightsFilterBars';
import { ChatsByCountrySection } from '../chats/ChatsByCountrySection';
import { LeadsEmptyState } from './LeadsEmptyState';
import { LeadsFieldCaptureChart } from './LeadsFieldCaptureChart';
import { LeadsPageSkeleton } from './LeadsPageSkeleton';
import { LeadsSummaryCards } from './LeadsSummaryCards';
import { LeadsTrendsSection } from './LeadsTrendsSection';
import { LeadsWidgetSourceChart } from './LeadsWidgetSourceChart';

function leadsCountriesAsChatsRows(
  countries: CustomerLeadsAnalyticsResponse['locationBreakdown']['countries'],
): CustomerChatsAnalyticsCountryRow[] {
  return countries.map((r) => ({
    country: r.country,
    countryCode: r.countryCode,
    conversations: Math.max(0, Math.trunc(r.conversations ?? 0)),
    messages: 0,
  }));
}

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
          subtitle="Capture rates, traffic sources, fields completed, and geography — aggregate counts only."
          filters={<LeadsAnalyticsFilterBar state={ui} onChange={setUi} disabled={loadState === 'loading'} />}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50/90 to-slate-100/50 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            {showSkeleton ? <LeadsPageSkeleton /> : null}
            {showError ? <AnalyticsErrorState onRetry={() => void load()} detail={errorMessage} /> : null}

            {showBody && data ? (
              <>
                {empty ? (
                  <LeadsEmptyState />
                ) : (
                  <>
                    <LeadsSummaryCards
                      summary={data.summary}
                      timeSeries={data.timeSeries}
                      granularity={data.range.granularity}
                    />
                    <LeadsTrendsSection data={data} />
                    <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-stretch">
                      <AnalyticsChartCard
                        className="h-full min-w-0 w-full border-slate-100"
                        fillVertical
                        noMaxHeight
                        bodyClassName="justify-center"
                        title="Widget Source"
                        description="Where conversations are coming from."
                      >
                        <LeadsWidgetSourceChart rows={data.startedFromBreakdown} />
                      </AnalyticsChartCard>
                      <AnalyticsChartCard
                        className="h-full min-w-0 w-full border-slate-100"
                        fillVertical
                        noMaxHeight
                        bodyClassName="flex min-h-0 w-full min-w-0 flex-1 flex-col"
                        title="Captured fields"
                        description="Per-field fill counts for configured lead forms — values are never listed."
                      >
                        <LeadsFieldCaptureChart
                          rows={data.fieldCaptureBreakdown}
                          statusFilter={ui.fieldCaptureStatus}
                        />
                      </AnalyticsChartCard>
                    </div>
                    <ChatsByCountrySection
                      countries={leadsCountriesAsChatsRows(data.locationBreakdown.countries)}
                      sectionTitle="Leads by Country"
                      modalTitle="Leads by Country"
                      sectionDescription="Where conversations are coming from."
                    />
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
