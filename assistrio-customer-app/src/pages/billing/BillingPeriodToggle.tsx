import { cn } from '@/lib/utils';
import type { PlanBillingPeriod } from '@/pages/billing/planPricingCardDisplay';

type Props = {
  value: PlanBillingPeriod;
  onChange: (period: PlanBillingPeriod) => void;
  disabled?: boolean;
};

const OPTIONS: Array<{ id: PlanBillingPeriod; label: string }> = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual', label: 'Annually' },
];

/** Matches analytics chart view toggles — teal selected pill on white chrome. */
export function BillingPeriodToggle({ value, onChange, disabled }: Props) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          'inline-flex w-full min-w-0 flex-wrap gap-0.5 rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-sm sm:min-w-[15rem]',
          disabled && 'opacity-60',
        )}
        role="tablist"
        aria-label="Billing period"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                'min-h-8 min-w-0 flex-1 basis-[48%] rounded-md px-2 py-1.5 text-center text-xs font-semibold transition-all duration-200 sm:px-3',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/20',
                selected ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
                disabled && 'cursor-not-allowed hover:bg-transparent',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
