import { cn } from '@/lib/utils';
import type { PlanBillingPeriod } from '@/pages/billing/planPricingCardDisplay';

type Props = {
  value: PlanBillingPeriod;
  onChange: (period: PlanBillingPeriod) => void;
  disabled?: boolean;
  annualAvailable?: boolean;
  annualUnavailableMessage?: string;
  className?: string;
  /** Narrow width for modal header (no full-width stretch). */
  compact?: boolean;
};

const OPTIONS: Array<{ id: PlanBillingPeriod; label: string }> = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual', label: 'Annually' },
];

/** Teal secondary chrome — unselected pills match {@link Button} outlinePrimary. */
export function BillingPeriodToggle({
  value,
  onChange,
  disabled,
  annualAvailable = true,
  annualUnavailableMessage,
  className,
  compact,
}: Props) {
  return (
    <div className={cn('min-w-0', className)}>
      <div
        className={cn(
          'inline-flex min-w-0 gap-0.5 rounded-[var(--ui-radius)] border border-[var(--color-teal-600)]/30 bg-[var(--teal-50)]/50 p-0.5',
          compact ? 'w-auto' : 'w-full sm:min-w-[12rem]',
          disabled && 'opacity-60',
        )}
        role="tablist"
        aria-label="Billing period"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.id;
          const optionDisabled =
            disabled || (option.id === 'annual' && !annualAvailable);

          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-disabled={optionDisabled || undefined}
              disabled={optionDisabled}
              title={
                option.id === 'annual' && !annualAvailable
                  ? annualUnavailableMessage
                  : undefined
              }
              onClick={() => {
                if (optionDisabled) return;
                onChange(option.id);
              }}
              className={cn(
                'min-h-[1.625rem] min-w-0 flex-1 rounded px-2 py-0.5 text-center text-[11px] font-semibold leading-tight transition-all duration-200',
                compact ? 'basis-auto px-2.5' : 'basis-[48%]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/25',
                selected
                  ? 'bg-[var(--color-teal-600)] text-white shadow-sm'
                  : 'text-[var(--color-teal-700)] hover:bg-white/90 hover:text-[var(--color-teal-800)]',
                optionDisabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {!annualAvailable && annualUnavailableMessage ? (
        <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-slate-500">{annualUnavailableMessage}</p>
      ) : null}
    </div>
  );
}
