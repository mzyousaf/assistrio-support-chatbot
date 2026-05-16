import { LayoutDashboard } from 'lucide-react';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { AnalyticsChartCard } from './AnalyticsChartCard';
import { AnalyticsPageHeader } from './AnalyticsPageHeader';

type Props = {
  title: string;
  subtitle: string;
  panelTitle: string;
  panelDescription: string;
};

/**
 * Topics, Sentiment, and other analytics routes that are not wired to data yet.
 */
export function AnalyticsPlaceholderPage({ title, subtitle, panelTitle, panelDescription }: Props) {
  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader title={title} subtitle={subtitle} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/40 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6 overflow-x-hidden">
            <AnalyticsChartCard title={panelTitle} description={panelDescription} bodyClassName="min-h-[280px]">
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-4 text-center">
                <LayoutDashboard className="mb-3 size-9 text-teal-600/35" strokeWidth={1.35} aria-hidden />
                <p className="m-0 text-sm font-medium text-slate-800">Coming soon</p>
                <p className="mt-2 mb-0 max-w-lg text-xs leading-relaxed text-slate-500">
                  These views need message classification and structured capture in the analytics pipeline. Until that
                  is enabled, Assistrio will not infer topics or sentiment from visitor conversations.
                </p>
              </div>
            </AnalyticsChartCard>
          </div>
        </div>
      </div>
    </WorkspaceContentContainer>
  );
}
