import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, MessagesSquare } from 'lucide-react';
import { getCustomerBotChatsAnalytics } from '@/api/customerApi';
import type { CustomerChatsAnalyticsResponse } from '@/api/types';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { useWorkspaceBillingSummary } from '@/hooks/useWorkspaceBillingSummary';
import {
  ANALYTICS_WINDOW_CLAMPED_NOTE,
  EXPORT_REPORTS_LOCKED_HELPER,
  canExportReportsEntitlement,
} from '@/lib/analyticsEntitlementCopy';
import { shouldShowAnalyticsWindowClampedNote } from '@/lib/analyticsEntitlementWindow';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { CHATS_ANALYTICS_DEFAULTS, buildChatsAnalyticsApiParams, type ChatsAnalyticsUiState } from '@/lib/chatsAnalyticsQuery';
import { safeClientString } from '@/lib/safeClientString';
import { useBotWorkspace } from '../../BotWorkspaceContext';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { ChatsAnalyticsFilterBar } from '../shared/AnalyticsInsightsFilterBars';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { ANALYTICS_TWO_CHART_ROW_GRID_CLASS } from '../shared/analyticsChartTheme';
import { AnalyticsErrorState, AnalyticsPageSkeleton } from './AnalyticsEmptyState';
import { AnalyticsSummaryCards } from './AnalyticsSummaryCards';
import { AnalyticsPageHeader } from '../shared/AnalyticsPageHeader';
import { ChatsActivityTrendsSection } from './ChatsActivityTrendsSection';
import { ChatsByCountrySection } from './ChatsByCountrySection';
import { ChatsMessageModalityTrendsSection } from './ChatsMessageModalityTrendsSection';
import { ChatsTopPagesPanel } from './ChatsTopPagesPanel';
import { ChatsWidgetSourceChart } from './ChatsWidgetSourceChart';
import { downloadChatsTopPagesCsv } from './chatsTopPagesExport';
import { hasTopPagesSignal } from './chatsTopPages.util';

export function ChatsAnalyticsPage() {
  const { botId } = useBotWorkspace();
  const { customer } = useCustomerAuth();
  const { activeWorkspaceId } = resolveActiveCustomerWorkspace(customer);
  const { summary: billingSummary } = useWorkspaceBillingSummary(activeWorkspaceId);
  const maxHistoryDays = billingSummary?.entitlements.analyticsHistoryDays ?? null;
  const canExportReports = canExportReportsEntitlement(billingSummary?.entitlements.canExportReports);
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
  const topPagesRows = useMemo(() => data?.topPagesBreakdown ?? [], [data]);
  const topPagesExportable = useMemo(() => hasTopPagesSignal(topPagesRows), [topPagesRows]);
  const exportTopPagesCsv = useCallback(() => {
    if (!canExportReports) return;
    downloadChatsTopPagesCsv(topPagesRows);
  }, [canExportReports, topPagesRows]);
  const showWindowClampedNote = shouldShowAnalyticsWindowClampedNote(data?.analyticsWindow);

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader
          title="Chats"
          titleIcon={MessagesSquare}
          subtitle="Conversation volume, visitor feedback, and activity over time."
          detail={
            showWindowClampedNote ? (
              <p className="m-0 text-xs leading-relaxed text-slate-500">{ANALYTICS_WINDOW_CLAMPED_NOTE}</p>
            ) : null
          }
          filters={
            <ChatsAnalyticsFilterBar
              state={ui}
              onChange={setUi}
              disabled={loadState === 'loading'}
              maxHistoryDays={maxHistoryDays}
            />
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50/90 to-slate-100/50 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            {showSkeleton ? <AnalyticsPageSkeleton /> : null}
            {showError ? <AnalyticsErrorState onRetry={() => void load()} detail={errorMessage} /> : null}

            {showBody && data ? (
              <>
                <AnalyticsSummaryCards
                  summary={data.summary}
                  timeSeries={data.timeSeries}
                  granularity={data.range.granularity}
                />
                <ChatsActivityTrendsSection data={data} />
                <div className={ANALYTICS_TWO_CHART_ROW_GRID_CLASS}>
                  <AnalyticsChartCard
                    className="h-full min-w-0 w-full border-slate-100"
                    fillVertical
                    noMaxHeight
                    bodyClassName="flex w-full min-h-0 flex-1 flex-col justify-center"
                    title="Widget Channel"
                    description="Where conversations are coming from."
                  >
                    <ChatsWidgetSourceChart rows={data.startedFromBreakdown} />
                  </AnalyticsChartCard>
                  <AnalyticsChartCard
                    className="h-full min-w-0 w-full border-slate-100"
                    fillVertical
                    noMaxHeight
                    bodyClassName="flex min-h-0 w-full min-w-0 flex-1 flex-col"
                    title="Top pages"
                    description="Pages where visitors started or continued chats."
                    titleAside={
                      topPagesExportable && canExportReports ? (
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
                      ) : topPagesExportable && !canExportReports ? (
                        <span className="max-w-[12rem] text-right text-[10px] leading-snug text-slate-500 sm:text-[11px]">
                          {EXPORT_REPORTS_LOCKED_HELPER}{' '}
                          <Link to="/settings/plans" className="font-medium text-teal-700 underline">
                            View plans
                          </Link>
                        </span>
                      ) : null
                    }
                  >
                    <ChatsTopPagesPanel rows={topPagesRows} />
                  </AnalyticsChartCard>
                </div>
                <ChatsByCountrySection countries={data.locationBreakdown.countries} />
                <ChatsMessageModalityTrendsSection data={data} />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceContentContainer>
  );
}

