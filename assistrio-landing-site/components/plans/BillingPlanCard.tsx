import { Check } from 'lucide-react';
import type { WorkspaceBillingPlanCatalogCard } from '@/types/billing';
import { Button } from "@/components/ui/button";
import { AnimatedPlanPriceDisplay } from '@/components/plans/AnimatedPlanPriceDisplay';
import {
  isRecommendedPlan,
  type PlanBillingPeriod,
  planPricingCardBestFor,
  planPricingCardIcon,
  planPricingCardTitle,
  planPricingCardTrialNote,
  planPricingCardWhySection,
} from '@/lib/plans/planPricingCardDisplay';
import { cn } from '@/lib/cn';

type Props = {
  plan: WorkspaceBillingPlanCatalogCard;
  isCurrent: boolean;
  billingPeriod?: PlanBillingPeriod;
  /** Overrides static plan-page recommendation for button emphasis. */
  recommended?: boolean;
  /** Shows a small Recommended badge when `recommended` is true. */
  showRecommendedBadge?: boolean;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  /** Landing marketing shimmer / custom button chrome */
  actionClassName?: string;
  /** Uses full-width custom action styling (no variant chrome). */
  marketingAction?: boolean;
  onAction?: () => void;
};

function PlanCornerTag({ label, planKey }: { label: string; planKey: string }) {
  return (
    <span
      className={cn(
        'absolute right-0 top-0 max-w-[11rem] rounded-bl-xl rounded-tr-2xl px-2.5 py-1 text-[10px] font-semibold leading-snug shadow-sm',
        planKey === 'starter' && 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80',
        planKey === 'pro' && 'bg-slate-900 text-white',
        (planKey === 'free' || !['starter', 'pro'].includes(planKey)) &&
          'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80',
      )}
    >
      {label}
    </span>
  );
}

function PlanIcon({ planKey }: { planKey: string }) {
  const { icon: Icon, className } = planPricingCardIcon(planKey);

  return (
    <Icon size={22} strokeWidth={1.75} className={cn('shrink-0', className)} aria-hidden />
  );
}

function PlanWhySection({ planKey }: { planKey: string }) {
  const { heading, bullets, footnote } = planPricingCardWhySection(planKey);

  return (
    <div className="text-left">
      <h4 className="m-0 text-xs font-semibold tracking-wide text-slate-800">{heading}</h4>
      <ul className="m-0 mt-3 list-none space-y-2 p-0">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <Check
              size={14}
              strokeWidth={2.25}
              className="mt-0.5 shrink-0 text-teal-600/80"
              aria-hidden
            />
            <span className="text-[13px] leading-snug text-slate-600">{bullet}</span>
          </li>
        ))}
      </ul>
      {footnote ? (
        <p className="m-0 mt-2.5 border-t border-slate-100/90 pt-2 text-[11px] font-normal text-slate-400">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

export function BillingPlanCard({
  plan,
  isCurrent,
  billingPeriod = 'monthly',
  recommended: recommendedOverride,
  showRecommendedBadge = false,
  actionLabel,
  actionDisabled = true,
  actionLoading = false,
  actionClassName,
  marketingAction = false,
  onAction,
}: Props) {
  const recommended = recommendedOverride ?? isRecommendedPlan(plan.key);
  const trialNote = planPricingCardTrialNote(plan.key);
  const buttonLabel =
    actionLabel ?? (isCurrent ? 'Current plan' : 'Coming soon');
  const buttonDisabled = actionDisabled || actionLoading;
  const useCustomAction = Boolean(marketingAction && actionClassName);

  return (
    <article
      aria-current={isCurrent ? 'true' : undefined}
      className="relative flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[var(--shadow-card)]"
    >
      {showRecommendedBadge && recommended ? (
        <span className="absolute left-0 top-0 rounded-br-xl rounded-tl-2xl bg-teal-50 px-2.5 py-1 text-[10px] font-semibold leading-snug text-teal-800 ring-1 ring-teal-200/80">
          Recommended
        </span>
      ) : null}
      <PlanCornerTag label={planPricingCardBestFor(plan.key)} planKey={plan.key} />

      <div className="pr-14 text-left">
        <div className="flex min-h-11 items-start gap-3">
          <PlanIcon planKey={plan.key} />
          <div className="min-w-0">
            <h3 className="m-0 min-w-0 text-lg font-semibold leading-snug tracking-tight text-slate-900">
              {planPricingCardTitle(plan.key, plan.name)}
            </h3>
          </div>
        </div>

        <AnimatedPlanPriceDisplay
          priceMonthly={plan.priceMonthly}
          planKey={plan.key}
          billingPeriod={billingPeriod}
        />
      </div>

      <div className="mt-4 w-full">
        {useCustomAction ? (
          <button
            type="button"
            disabled={buttonDisabled}
            className={cn("inline-flex items-center justify-center", actionClassName)}
            onClick={onAction}
          >
            {actionLoading ? "Starting checkout…" : buttonLabel}
          </button>
        ) : (
          <Button
            type="button"
            variant={recommended && !buttonDisabled ? "primary" : "secondary"}
            size="md"
            disabled={buttonDisabled}
            className="h-11 w-full min-w-full rounded-xl text-sm"
            onClick={onAction}
          >
            {actionLoading ? "Starting checkout…" : buttonLabel}
          </Button>
        )}
      </div>

      <div className="mt-6 flex-1 border-t border-slate-100 pt-5">
        <PlanWhySection planKey={plan.key} />
      </div>

      {trialNote ? (
        <p className="m-0 mt-4 border-t border-slate-100 pt-4 text-left text-[11px] leading-snug text-slate-400">
          {trialNote}
        </p>
      ) : null}
    </article>
  );
}
