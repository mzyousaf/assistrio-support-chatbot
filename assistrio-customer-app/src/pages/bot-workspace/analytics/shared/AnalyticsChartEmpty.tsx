import { cn } from '@/lib/utils';
import { ANALYTICS_CHART_BLOCK_HEIGHT_CLASS } from './analyticsChartTheme';

type Props = {
  message: string;
  className?: string;
};

export function AnalyticsChartEmpty({ message, className }: Props) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center text-sm leading-snug text-slate-500',
        ANALYTICS_CHART_BLOCK_HEIGHT_CLASS,
        className,
      )}
    >
      {message}
    </div>
  );
}
