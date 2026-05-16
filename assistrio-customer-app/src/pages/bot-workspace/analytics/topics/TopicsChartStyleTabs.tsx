import { cn } from '@/lib/utils';
import type { TopicsChartStyle } from './topicsChartHelpers';

type Props = {
  value: TopicsChartStyle;
  onChange: (v: TopicsChartStyle) => void;
  disabled?: boolean;
};

const tabs: { id: TopicsChartStyle; label: string }[] = [
  { id: 'line', label: 'Trends' },
  { id: 'donut', label: 'Distribution' },
];

export function TopicsChartStyleTabs({ value, onChange, disabled }: Props) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          'inline-flex w-full min-w-0 flex-wrap gap-0.5 rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-sm sm:min-w-[14rem]',
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
                'min-h-7 min-w-0 flex-1 basis-[48%] rounded-md px-2 py-1.5 text-center text-xs font-semibold transition-all duration-200 sm:px-3',
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
