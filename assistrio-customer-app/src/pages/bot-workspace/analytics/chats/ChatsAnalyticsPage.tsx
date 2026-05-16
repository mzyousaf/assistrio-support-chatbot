import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, MessagesSquare } from 'lucide-react';
import { getCustomerBotChatsAnalytics } from '@/api/customerApi';
import type { CustomerChatsAnalyticsResponse } from '@/api/types';
import { CHATS_ANALYTICS_DEFAULTS, buildChatsAnalyticsApiParams, type ChatsAnalyticsUiState } from '@/lib/chatsAnalyticsQuery';
import { safeClientString } from '@/lib/safeClientString';
import { useBotWorkspace } from '../../BotWorkspaceContext';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { ChatsAnalyticsFilterBar } from '../shared/AnalyticsInsightsFilterBars';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { AnalyticsEmptyState, AnalyticsErrorState, AnalyticsPageSkeleton } from './AnalyticsEmptyState';
import { AnalyticsSummaryCards } from './AnalyticsSummaryCards';
import { AnalyticsPageHeader } from '../shared/AnalyticsPageHeader';
import { ChatsActivityTrendsSection } from './ChatsActivityTrendsSection';
import { ChatsByCountrySection } from './ChatsByCountrySection';
import { ChatsTopPagesPanel } from './ChatsTopPagesPanel';
import { ChatsWidgetSourceChart } from './ChatsWidgetSourceChart';
import { downloadChatsTopPagesCsv } from './chatsTopPagesExport';
import { hasTopPagesSignal } from './chatsTopPages.util';

function hasAnalyticsSignal(data: CustomerChatsAnalyticsResponse | null): boolean {
  if (!data) return false;
  const s = data.summary;
  return (
    (s.totalConversations ?? 0) > 0 ||
    (s.totalMessages ?? 0) > 0 ||
    (s.totalThumbsUp ?? 0) > 0 ||
    (s.totalThumbsDown ?? 0) > 0
  );
}

export function ChatsAnalyticsPage() {
  const { botId } = useBotWorkspace();
  const [ui, setUi] = useState<ChatsAnalyticsUiState>(() => ({ ...CHATS_ANALYTICS_DEFAULTS }));
  const [data, setData] = useState<CustomerChatsAnalyticsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const params = useMemo(() => buildChatsAnalyticsApiParams(ui), [ui]);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoadState('loading');
    setErrorMessage('');
    const res = await getCustomerBotChatsAnalytics(botId, params);
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
  const empty = loadState === 'ok' && data && !hasAnalyticsSignal(data);
  const topPagesRows = useMemo(() => data?.topPagesBreakdown ?? [], [data]);
  const topPagesExportable = useMemo(() => hasTopPagesSignal(topPagesRows), [topPagesRows]);
  const exportTopPagesCsv = useCallback(() => {
    downloadChatsTopPagesCsv(topPagesRows);
  }, [topPagesRows]);

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader
          title="Chats"
          titleIcon={MessagesSquare}
          subtitle="Conversation volume, visitor feedback, and activity over time."
          filters={<ChatsAnalyticsFilterBar state={ui} onChange={setUi} disabled={loadState === 'loading'} />}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50/90 to-slate-100/50 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            {showSkeleton ? <AnalyticsPageSkeleton /> : null}
            {showError ? <AnalyticsErrorState onRetry={() => void load()} detail={errorMessage} /> : null}

            {showBody && data ? (
              <>
                {empty ? (
                  <AnalyticsEmptyState />
                ) : (
                  <>
                    <AnalyticsSummaryCards summary={data.summary} />
                    <ChatsActivityTrendsSection data={data} />
                    <ChatsByCountrySection countries={data.locationBreakdown.countries} />
                    <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-stretch">
                      <AnalyticsChartCard
                        className="h-full border-slate-100"
                        fillVertical
                        noMaxHeight
                        bodyClassName="justify-center"
                        title="Widget Source"
                        description="Where conversations are coming from."
                      >
                        <ChatsWidgetSourceChart rows={data.startedFromBreakdown} />
                      </AnalyticsChartCard>
                      <AnalyticsChartCard
                        className="h-full border-slate-100"
                        fillVertical
                        noMaxHeight
                        bodyClassName="flex min-h-0 flex-1 flex-col"
                        title="Top pages"
                        description="Pages where visitors started or continued chats."
                        titleAside={
                          topPagesExportable ? (
                            <button
                              type="button"
                              className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 sm:text-xs"
                              aria-label={`Export all ${topPagesRows.length} top pages as CSV`}
                              onClick={exportTopPagesCsv}
                            >
                              <Download
                                className="h-3 w-3 shrink-0 text-slate-600 sm:h-3.5 sm:w-3.5"
                                strokeWidth={2.25}
                                aria-hidden
                              />
                              <span>Export</span>
                            </button>
                          ) : null
                        }
                      >
                        <ChatsTopPagesPanel rows={topPagesRows} />
                      </AnalyticsChartCard>
                    </div>
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

