import { cn } from '@/lib/utils';

export type UsageChartViewMode = 'trend' | 'highlights';

type Props = {
  value: UsageChartViewMode;
  onChange: (mode: UsageChartViewMode) => void;
};

const OPTIONS: { id: UsageChartViewMode; label: string }[] = [
  { id: 'trend', label: 'Trend' },
  { id: 'highlights', label: 'Highlights' },
];

export function UsageChartViewToggle({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200/90 bg-slate-50/80 p-0.5"
      role="group"
      aria-label="Usage chart view"
    >
      {OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-white shadow-[var(--shadow-primary-fill)]'
                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900',
            )}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
