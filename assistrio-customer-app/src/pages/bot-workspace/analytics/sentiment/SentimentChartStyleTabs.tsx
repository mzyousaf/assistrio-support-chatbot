import { cn } from '@/lib/utils';
import type { SentimentChartStyle } from './sentimentTrendsChartHelpers';

type Props = {
  value: SentimentChartStyle;
  onChange: (v: SentimentChartStyle) => void;
  disabled?: boolean;
};

const tabs: { id: SentimentChartStyle; label: string }[] = [
  { id: 'trend', label: 'Trends' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'bar', label: 'Heights' },
];

export function SentimentChartStyleTabs({ value, onChange, disabled }: Props) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          'inline-flex w-full min-w-0 flex-wrap gap-0.5 rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-sm sm:min-w-[16rem]',
          disabled && 'opacity-60',
        )}
        role="tablist"
        aria-label="Chart view"
      >
        {tabs.map((t) => {
          const selected = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(t.id)}
              className={cn(
                'min-h-7 min-w-0 flex-1 basis-[31%] rounded-md px-1.5 py-1.5 text-center text-xs font-semibold transition-all duration-200 sm:px-2.5',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/20',
                selected ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
                disabled && 'cursor-not-allowed hover:bg-transparent',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
