import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import type { CustomerAgentResourcesAnalyticsResponse } from '@/api/types';
import { getCustomerBotAgentResourcesAnalytics } from '@/api/customerApi';
import {
  AGENT_RESOURCES_ANALYTICS_DEFAULTS,
  buildAgentResourcesAnalyticsApiParams,
  type AgentResourcesAnalyticsUiState,
} from '@/lib/agentResourcesAnalyticsQuery';
import { safeClientString } from '@/lib/safeClientString';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { useBotWorkspace } from '../../BotWorkspaceContext';
import { AgentResourcesAnalyticsFilterBar } from '../shared/AnalyticsInsightsFilterBars';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { AnalyticsErrorState } from '../shared/AnalyticsErrorState';
import { AnalyticsPageHeader } from '../shared/AnalyticsPageHeader';
import { AnalyticsPageSkeleton } from '@/pages/bot-workspace/analytics/shared/AnalyticsPageSkeleton';
import { AgentResourcesKbSourceTrendsSection } from './AgentResourcesKbSourceTrendsSection';
import { AgentResourcesTopPrimarySourcesChart } from './AgentResourcesTopPrimarySourcesChart';
import { AgentResourcesUsageSummaryCards } from './AgentResourcesUsageSummaryCards';
import { AgentResourcesUsageTrendsSection } from './AgentResourcesUsageTrendsSection';

function hasAgentResourcesSignal(data: CustomerAgentResourcesAnalyticsResponse | null): boolean {
  if (!data) return false;
  const msgs =
    (data.knowledgeBase.summary.messagesWithSources ?? 0) +
    (data.knowledgeBase.summary.messagesWithoutSources ?? 0);
  return (data.usage.summary.totalCreditsUsed ?? 0) > 0 || msgs > 0;
}

function AgentResourcesAnalyticsEmptyState() {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-8 py-12 text-center shadow-sm">
      <p className="m-0 text-sm font-semibold text-slate-800">Nothing in this range yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        Try widening the date range or including preview sessions. AI Credits and KB sources populate as visitors chat with
        this assistant.
      </p>
    </div>
  );
}

export function AgentResourcesAnalyticsPage() {
  const { botId } = useBotWorkspace();
  const [ui, setUi] = useState<AgentResourcesAnalyticsUiState>(() => ({ ...AGENT_RESOURCES_ANALYTICS_DEFAULTS }));
  const [data, setData] = useState<CustomerAgentResourcesAnalyticsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const params = useMemo(() => buildAgentResourcesAnalyticsApiParams(ui), [ui]);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoadState('loading');
    setErrorMessage('');
    const res = await getCustomerBotAgentResourcesAnalytics(botId, params);
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
  const empty = loadState === 'ok' && data && !hasAgentResourcesSignal(data);

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader
          title="Agent Resources"
          titleIcon={Layers}
          subtitle="Track AI Credits Usage and the knowledge sources your assistant relies on."
          filters={
            <AgentResourcesAnalyticsFilterBar state={ui} onChange={setUi} disabled={loadState === 'loading'} />
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/40 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-10">
            {showSkeleton ? <AnalyticsPageSkeleton layout="knowledge" /> : null}
            {showError ? <AnalyticsErrorState onRetry={() => void load()} detail={errorMessage} /> : null}

            {showBody && data ? (
              <>
                {empty ? (
                  <AgentResourcesAnalyticsEmptyState />
                ) : (
                  <>
                    <section
                      className="space-y-6 border-b border-slate-200/90 pb-10"
                      aria-labelledby="agent-resources-usage-heading"
                    >
                      <div>
                        <h2 id="agent-resources-usage-heading" className="m-0 text-xl font-semibold text-slate-900 sm:text-2xl">
                          AI Credits Usage
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          AI Credits for visitor messaging in the selected funnel.
                        </p>
                      </div>
                      <AgentResourcesUsageSummaryCards
                        summary={data.usage.summary}
                        creditRules={data.usage.creditRules}
                        timeSeries={data.usage.timeSeries}
                        granularity={data.range.granularity}
                      />
                      <AgentResourcesUsageTrendsSection
                        summary={data.usage.summary}
                        timeSeries={data.usage.timeSeries}
                        granularity={data.range.granularity}
                        creditRules={data.usage.creditRules}
                        rangeFrom={data.range.from}
                        rangeTo={data.range.to}
                      />
                    </section>

                    <section className="space-y-6" aria-labelledby="agent-resources-kb-heading">
                      <div>
                        <h2 id="agent-resources-kb-heading" className="m-0 text-xl font-semibold text-slate-900 sm:text-2xl">
                          Knowledge Base Usage
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Primary source attribution per assistant answer — one source counted per reply.
                        </p>
                      </div>
                      <AgentResourcesKbSourceTrendsSection
                        summary={data.knowledgeBase.summary}
                        timeSeries={data.knowledgeBase.timeSeries}
                        sourceTypeBreakdown={data.knowledgeBase.sourceTypeBreakdown}
                        granularity={data.range.granularity}
                      />
                      <AnalyticsChartCard
                        title="Top sources"
                        description="Knowledge items cited most often as the primary source in assistant replies."
                        noMaxHeight
                        bodyClassName="min-h-[260px]"
                      >
                        <AgentResourcesTopPrimarySourcesChart rows={data.knowledgeBase.topPrimarySources} />
                      </AnalyticsChartCard>
                    </section>
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
