import { useEffect, useRef, useState } from 'react';
import {
  formatPlanPriceAmount,
  formatPlanPriceCardParts,
  resolvePlanCardDisplayPrice,
  type PlanBillingPeriod,
} from '@/lib/plans/planPricingCardDisplay';

const PRICE_ANIMATION_MS = 450;
const SHOULD_ANIMATE_PRICES = process.env.NODE_ENV !== "test";

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
  planKey: string;
  billingPeriod?: PlanBillingPeriod;
};

export function AnimatedPlanPriceDisplay({
  priceMonthly,
  planKey,
  billingPeriod = 'monthly',
}: Props) {
  const targetPrice = resolvePlanCardDisplayPrice(priceMonthly, { planKey, billingPeriod });
  const animatedPrice = useAnimatedNumber(targetPrice);
  const { cadence, savingsTag, billingNote } = formatPlanPriceCardParts(priceMonthly, {
    planKey,
    billingPeriod,
  });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className="text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums text-slate-900 transition-transform duration-300 ease-out"
          aria-live="polite"
          aria-atomic="true"
        >
          {formatPlanPriceAmount(animatedPrice)}
        </span>
        {savingsTag ? (
          <span className="plan-price-tag-in rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 animate-[planPriceTagIn_320ms_ease-out_both]">
            {savingsTag}
          </span>
        ) : null}
      </div>
      {cadence ? (
        <p className="m-0 mt-1 text-xs font-normal leading-snug text-slate-400">{cadence}</p>
      ) : null}
      {billingNote ? (
        <p className="plan-price-note-in m-0 mt-1 animate-[planPriceNoteIn_320ms_ease-out_both] text-xs font-medium text-slate-500">
          {billingNote}
        </p>
      ) : null}
    </div>
  );
}
