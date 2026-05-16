import { cn } from '@/lib/utils';

type Props = {
  message: string;
  className?: string;
};

export function AnalyticsChartEmpty({ message, className }: Props) {
  return (
    <div
      className={cn(
        'flex min-h-[180px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center text-sm leading-snug text-slate-500',
        className,
      )}
    >
      {message}
    </div>
  );
}
