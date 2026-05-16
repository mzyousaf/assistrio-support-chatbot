import { cn } from '@/lib/utils';
import type { TopicsMetricMode } from './topicsChartHelpers';

type Props = {
  value: TopicsMetricMode;
  onChange: (v: TopicsMetricMode) => void;
  disabled?: boolean;
};

const tabs: { id: TopicsMetricMode; label: string }[] = [
  { id: 'messages', label: 'By messages' },
  { id: 'conversations', label: 'By conversations' },
];

export function TopicsMetricModeTabs({ value, onChange, disabled }: Props) {
  return (
    <div className="w-full min-w-0 sm:w-auto sm:min-w-[20rem]">
      <div
        className={cn(
          'inline-flex w-full max-w-full flex-wrap gap-0.5 rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-sm',
          disabled && 'opacity-60',
        )}
        role="tablist"
        aria-label="Topics metric"
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
                'min-h-9 min-w-0 flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/20',
                selected
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50',
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
