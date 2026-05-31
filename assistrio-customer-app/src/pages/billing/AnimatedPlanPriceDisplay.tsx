import { useEffect, useRef, useState } from 'react';
import {
  formatPlanPriceAmount,
  formatPlanPriceCardParts,
  resolvePlanCardDisplayPrice,
  type PlanBillingPeriod,
  type PlanPricingSource,
} from '@/pages/billing/planPricingCardDisplay';
import { cn } from '@/lib/utils';

const PRICE_ANIMATION_MS = 450;
const SHOULD_ANIMATE_PRICES = !import.meta.env.VITEST;

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useAnimatedNumber(target: number, durationMs = PRICE_ANIMATION_MS): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (fromRef.current === target) {
      setDisplay(target);
      return;
    }

    if (!SHOULD_ANIMATE_PRICES || prefersReducedMotion()) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const next = Math.round(from + (target - from) * easeOutCubic(progress));
      setDisplay(next);

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}

type Props = {
  priceMonthly: number | null | undefined;
  /** Omit for generic recurring prices (e.g. add-ons). */
  planKey?: string;
  billingPeriod?: PlanBillingPeriod;
  pricing?: PlanPricingSource | null;
  align?: 'left' | 'center';
  size?: 'default' | 'compact' | 'embedded';
  /** When true, sits beside a plan title with no top margin (upgrade panel). */
  inlineWithTitle?: boolean;
};

export function AnimatedPlanPriceDisplay({
  priceMonthly,
  planKey,
  billingPeriod = 'monthly',
  pricing,
  align = 'left',
  size = 'default',
  inlineWithTitle = false,
}: Props) {
  const centered = align === 'center';
  const compact = size === 'compact';
  const embedded = size === 'embedded';
  const targetPrice = resolvePlanCardDisplayPrice(priceMonthly, { planKey, billingPeriod, pricing });
  const animatedPrice = useAnimatedNumber(targetPrice);
  const { cadence, savingsTag, billingNote } = formatPlanPriceCardParts(priceMonthly, {
    planKey,
    billingPeriod,
    pricing,
  });
  const price = Number(priceMonthly ?? 0);
  const hasPaidPrice = Number.isFinite(price) && price > 0;
  const reserveSavingsTagSlot = planKey !== 'free' && hasPaidPrice;
  const showAnnualInline =
    billingPeriod === 'annual' && reserveSavingsTagSlot && Boolean(cadence);

  if (embedded && hasPaidPrice && (showAnnualInline || cadence)) {
    return (
      <div className={cn('min-w-0', inlineWithTitle ? '' : 'mt-1')}>
        <p
          className={cn(
            'm-0 flex flex-nowrap items-baseline gap-x-1.5 leading-snug text-slate-500',
            inlineWithTitle
              ? 'text-sm'
              : 'overflow-x-auto text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            className={cn(
              'shrink-0 font-semibold tabular-nums text-slate-600',
              inlineWithTitle ? 'text-sm font-medium text-slate-500' : 'text-base',
            )}
          >
            {formatPlanPriceAmount(animatedPrice)}
          </span>
          {showAnnualInline ? (
            <>
              <span className="shrink-0 whitespace-nowrap">{` / month${cadence ?? ''}`}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full border border-teal-200/80 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap text-teal-700',
                  savingsTag && 'plan-price-tag-in animate-[planPriceTagIn_320ms_ease-out_both]',
                )}
              >
                {savingsTag}
              </span>
            </>
          ) : (
            <span className="shrink-0 whitespace-nowrap">{cadence}</span>
          )}
        </p>
      </div>
    );
  }

  if (showAnnualInline) {
    return (
      <div
        className={cn(
          compact
            ? centered
              ? 'mt-2 flex flex-col items-center'
              : 'mt-2'
            : centered
              ? 'mt-4 flex flex-col items-center'
              : 'mt-4',
        )}
      >
        <p
          className={cn(
            'm-0 flex flex-nowrap items-baseline gap-x-1.5 leading-snug text-slate-500',
            centered ? 'justify-center' : '',
            compact ? 'text-xs' : 'text-sm',
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            className={cn(
              'shrink-0 font-semibold tabular-nums text-slate-900',
              compact ? 'text-2xl' : 'text-[2.5rem]',
            )}
          >
            {formatPlanPriceAmount(animatedPrice)}
          </span>
          <span className={cn('shrink-0 whitespace-nowrap', compact ? 'text-xs' : 'text-sm')}>
            {` / month${cadence ?? ''}`}
          </span>
          <span
            className={cn(
              'shrink-0 self-center rounded-full border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap text-teal-700',
              savingsTag && 'plan-price-tag-in animate-[planPriceTagIn_320ms_ease-out_both]',
            )}
          >
            {savingsTag}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        embedded
          ? 'mt-1'
          : compact
            ? centered
              ? 'mt-2 flex flex-col items-center'
              : 'mt-2'
            : centered
              ? 'mt-4 flex flex-col items-center'
              : 'mt-4',
      )}
    >
      <div
        className={cn(
          'flex flex-nowrap items-baseline gap-x-2',
          centered ? 'justify-center' : '',
        )}
      >
        <span
          className={cn(
            'shrink-0 font-semibold leading-none tracking-tight tabular-nums text-slate-900 transition-transform duration-300 ease-out',
            embedded ? 'text-base text-slate-600' : compact ? 'text-2xl' : 'text-[2.5rem]',
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {formatPlanPriceAmount(animatedPrice)}
        </span>
        {reserveSavingsTagSlot ? (
          <span
            className={cn(
              'shrink-0 self-center rounded-full border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold leading-none text-teal-700',
              embedded ? 'mt-0.5 text-[10px] font-semibold' : 'mt-2',
              savingsTag && 'plan-price-tag-in animate-[planPriceTagIn_320ms_ease-out_both]',
              !savingsTag && 'invisible',
            )}
            aria-hidden={!savingsTag}
          >
            {savingsTag}
          </span>
        ) : null}
      </div>
      {cadence ? (
        <p
          className={cn(
            'm-0 mt-1 font-normal leading-snug text-slate-400',
            embedded ? 'text-[11px] text-slate-500' : 'text-xs',
            reserveSavingsTagSlot && !embedded && (compact ? 'min-h-8' : 'min-h-5'),
            reserveSavingsTagSlot && embedded && 'min-h-4',
          )}
        >
          {cadence}
        </p>
      ) : null}
      {billingNote ? (
        <p className="plan-price-note-in m-0 mt-1 animate-[planPriceNoteIn_320ms_ease-out_both] text-xs font-medium text-slate-500">
          {billingNote}
        </p>
      ) : null}
    </div>
  );
}
