import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getCustomerBotKnowledgeSourcesAnalytics } from '@/api/customerApi';
import type { CustomerKnowledgeSourcesAnalyticsResponse } from '@/api/types';
import { safeClientString } from '@/lib/safeClientString';
import {
  KNOWLEDGE_SOURCES_ANALYTICS_DEFAULTS,
  buildKnowledgeSourcesAnalyticsApiParams,
  type KnowledgeSourcesAnalyticsUiState,
} from '@/lib/knowledgeSourcesAnalyticsQuery';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { useBotWorkspace } from '../../BotWorkspaceContext';
import { AnalyticsChartCard } from '../chats/AnalyticsChartCard';
import { AnalyticsErrorState } from '../shared/AnalyticsErrorState';
import { AnalyticsPageHeader } from '../shared/AnalyticsPageHeader';
import { KnowledgeSourcesActivityChart } from './KnowledgeSourcesActivityChart';
import { KnowledgeSourcesEmptyState } from './KnowledgeSourcesEmptyState';
import { KnowledgeSourcesAnalyticsFilterBar } from '../shared/AnalyticsInsightsFilterBars';
import { KnowledgeSourcesPageSkeleton } from './KnowledgeSourcesPageSkeleton';
import { KnowledgeSourcesSummaryCards } from './KnowledgeSourcesSummaryCards';
import { NoSourceAnswersCard } from './NoSourceAnswersCard';
import { SourceTypeBreakdownChart } from './SourceTypeBreakdownChart';
import { TopSourcesTable } from './TopSourcesTable';

function hasKnowledgeAnalyticsSignal(data: CustomerKnowledgeSourcesAnalyticsResponse | null): boolean {
  if (!data) return false;
  return (data.summary.totalAssistantMessages ?? 0) > 0;
}

export function KnowledgeSourcesAnalyticsPage() {
  const { botId } = useBotWorkspace();
  const [ui, setUi] = useState<KnowledgeSourcesAnalyticsUiState>(() => ({ ...KNOWLEDGE_SOURCES_ANALYTICS_DEFAULTS }));
  const [data, setData] = useState<CustomerKnowledgeSourcesAnalyticsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const params = useMemo(() => buildKnowledgeSourcesAnalyticsApiParams(ui), [ui]);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoadState('loading');
    setErrorMessage('');
    const res = await getCustomerBotKnowledgeSourcesAnalytics(botId, params);
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
  const empty = loadState === 'ok' && data && !hasKnowledgeAnalyticsSignal(data);

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader
          title="Knowledge Sources"
          titleIcon={BookOpen}
          subtitle="See which knowledge sources your assistant uses when answering visitors."
          filters={
            <KnowledgeSourcesAnalyticsFilterBar state={ui} onChange={setUi} disabled={loadState === 'loading'} />
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/40 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            {showSkeleton ? <KnowledgeSourcesPageSkeleton /> : null}
            {showError ? <AnalyticsErrorState onRetry={() => void load()} detail={errorMessage} /> : null}

            {showBody && data ? (
              <>
                {empty ? (
                  <KnowledgeSourcesEmptyState />
                ) : (
                  <>
                    <KnowledgeSourcesSummaryCards summary={data.summary} />
                    <AnalyticsChartCard
                      title="Source activity"
                      description="How often answers cite knowledge, and citation volume over time."
                      bodyClassName="h-[min(360px,55vh)] min-h-[280px] w-full max-w-full"
                    >
                      <KnowledgeSourcesActivityChart points={data.timeSeries} granularity={data.range.granularity} />
                    </AnalyticsChartCard>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <AnalyticsChartCard
                        title="By source type"
                        description="Where citations come from in your knowledge base."
                        bodyClassName="min-h-[260px]"
                      >
                        <SourceTypeBreakdownChart rows={data.sourceTypeBreakdown} />
                      </AnalyticsChartCard>
                      <NoSourceAnswersCard summary={data.summary} />
                    </div>
                    <AnalyticsChartCard title="Top sources" description="Most frequently cited knowledge items and safe links.">
                      <TopSourcesTable rows={data.topSources} />
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
