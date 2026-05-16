import { cn } from '@/lib/utils';
import { ANALYTICS_TWO_CHART_ROW_GRID_CLASS } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from '@/pages/bot-workspace/analytics/topics/topicsAnalyticsSectionLayout';

type Layout = 'chats' | 'knowledge' | 'leads' | 'topics' | 'sentiment';

type Props = { layout: Layout };

/**
 * Loading placeholders aligned to each analytics route’s section order and grid breakpoints
 * (`xl` for two-column chart rows — matches live pages).
 */
export function AnalyticsPageSkeleton({ layout }: Props) {
  const pulse = 'animate-pulse rounded-md bg-slate-200/80';

  const largeTrendsCard = (
    <div
      className={cn(
        pulse,
        'w-full rounded-[0.625rem] border border-slate-100/80',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
    />
  );

  const twoChartRow = (
    <div className={ANALYTICS_TWO_CHART_ROW_GRID_CLASS}>
      <div className={cn(pulse, 'h-[360px] min-h-[360px] w-full rounded-[0.625rem] border border-slate-100/80')} />
      <div className={cn(pulse, 'h-[360px] min-h-[360px] w-full rounded-[0.625rem] border border-slate-100/80')} />
    </div>
  );

  if (layout === 'chats') {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn('h-28 rounded-md', pulse)} />
          ))}
        </div>
        {largeTrendsCard}
        {twoChartRow}
        <div className={cn(pulse, 'h-[580px] min-h-[580px] w-full rounded-[0.625rem] border border-slate-100/80')} />
        {largeTrendsCard}
      </div>
    );
  }

  if (layout === 'topics') {
    return (
      <div className="flex flex-col gap-6">
        {largeTrendsCard}
        {twoChartRow}
      </div>
    );
  }

  if (layout === 'leads') {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn('h-28 rounded-md', pulse)} />
          ))}
        </div>
        {largeTrendsCard}
        {twoChartRow}
        <div className={cn(pulse, 'h-[580px] min-h-[580px] w-full rounded-[0.625rem] border border-slate-100/80')} />
      </div>
    );
  }

  if (layout === 'sentiment') {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={cn('h-28 rounded-md', pulse)} />
          ))}
        </div>
        {largeTrendsCard}
      </div>
    );
  }

  /* knowledge — Agent Resources */
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 border-b border-slate-200/90 pb-10">
        <div className="space-y-1">
          <div className={cn('h-7 w-56 rounded-md', pulse)} />
          <div className={cn('h-4 w-72 max-w-full rounded-md', pulse)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn('h-28 rounded-md', pulse)} />
          ))}
        </div>
        {largeTrendsCard}
      </div>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <div className={cn('h-7 w-64 rounded-md', pulse)} />
          <div className={cn('h-4 w-80 max-w-full rounded-md', pulse)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('h-24 rounded-md', pulse)} />
          ))}
        </div>
        {largeTrendsCard}
        <div className={cn(pulse, 'h-[320px] min-h-[320px] w-full rounded-[0.625rem] border border-slate-100/80')} />
      </div>
    </div>
  );
}
