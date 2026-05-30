import type { LucideIcon } from 'lucide-react';
import { Crown, Gift, Rocket } from 'lucide-react';
import type { WorkspaceBillingPlanCatalogCard } from '@/types/billing';

export type PlanChecklistItem = {
  label: string;
  included: boolean;
};

export type PlanChecklistSection = {
  subheading: string;
  items: PlanChecklistItem[];
};

export type PlanCardFeatures = {
  heading: string;
  intro?: string;
  footnote?: string;
  sections: PlanChecklistSection[];
};

export type PlanBillingPeriod = 'monthly' | 'annual';

export const ANNUAL_PLAN_DISCOUNT_RATE = 0.2;

export function applyAnnualPlanDiscount(priceMonthly: number): number {
  return Math.round(priceMonthly * (1 - ANNUAL_PLAN_DISCOUNT_RATE));
}

export function resolvePlanCardAnnualTotal(priceMonthly: number): number {
  return Math.round(priceMonthly * 12 * (1 - ANNUAL_PLAN_DISCOUNT_RATE));
}

export function formatPlanAnnualCadenceLine(priceMonthly: number): string {
  const annualTotal = resolvePlanCardAnnualTotal(priceMonthly);
  return `per month, ${formatPlanPriceAmount(annualTotal)} billed annually`;
}

export function resolvePlanCardDisplayPrice(
  priceMonthly: number | null | undefined,
  options?: { planKey?: string; billingPeriod?: PlanBillingPeriod },
): number {
  const billingPeriod = options?.billingPeriod ?? 'monthly';
  const price = Number(priceMonthly ?? 0);

  if (options?.planKey === 'free' || !Number.isFinite(price) || price <= 0) {
    return 0;
  }

  if (billingPeriod === 'annual') {
    return applyAnnualPlanDiscount(price);
  }

  return price;
}

export function formatPlanPriceAmount(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function formatPlanPriceCardLabel(priceMonthly: number | null | undefined): string {
  const price = Number(priceMonthly ?? 0);
  if (!Number.isFinite(price) || price <= 0) return '$0/mo';
  return `$${price.toLocaleString()}/mo`;
}

export function formatPlanPriceCardParts(
  priceMonthly: number | null | undefined,
  options?: { planKey?: string; billingPeriod?: PlanBillingPeriod },
): {
  amount: string;
  cadence: string | null;
  savingsTag?: string | null;
  billingNote?: string | null;
} {
  const billingPeriod = options?.billingPeriod ?? 'monthly';
  const price = Number(priceMonthly ?? 0);

  if (options?.planKey === 'free' || !Number.isFinite(price) || price <= 0) {
    return { amount: '$0', cadence: 'per month' };
  }

  if (billingPeriod === 'annual') {
    const discountedMonthly = applyAnnualPlanDiscount(price);
    return {
      amount: `$${discountedMonthly.toLocaleString()}`,
      cadence: formatPlanAnnualCadenceLine(price),
      savingsTag: 'Save 20%',
    };
  }

  const label = formatPlanPriceCardLabel(priceMonthly);
  if (!label.endsWith('/mo')) return { amount: label, cadence: null };
  return { amount: label.slice(0, -3), cadence: 'per month' };
}

export function planPricingCardDescription(planKey: string): string {
  if (planKey === 'starter') {
    return 'More credits, storage, and unlimited history for growing teams.';
  }
  if (planKey === 'pro') {
    return 'Higher limits, advanced analytics, and priority support.';
  }
  return 'Start testing Assistrio with essential workspace limits.';
}

export type PlanPricingCardDescriptionDisplay = {
  items: readonly string[];
  footnote?: string;
};

export function planPricingCardDescriptionDisplay(planKey: string): PlanPricingCardDescriptionDisplay {
  if (planKey === 'starter') {
    return { items: [] };
  }
  if (planKey === 'pro') {
    return {
      items: ['Higher limits', 'Priority support'],
    };
  }
  return {
    items: ['Start testing Assistrio'],
  };
}

export function planPricingCardTitle(planKey: string, planName: string): string {
  if (planKey === 'free') return '7-day free trial';
  return planName;
}

export function planPricingCardBestFor(planKey: string): string {
  if (planKey === 'starter') return 'Best value for small businesses';
  if (planKey === 'pro') return 'Best value for growing business';
  return 'Best for testing';
}

export function planPricingCardTrialNote(planKey: string): string | null {
  if (planKey !== 'free') return null;
  return 'Auto-expires after 7 days or when included AI credits run out.';
}

export type PlanPricingCardIcon = {
  icon: LucideIcon;
  className: string;
};

export function planPricingCardIcon(planKey: string): PlanPricingCardIcon {
  if (planKey === 'starter') {
    return { icon: Rocket, className: 'text-amber-600' };
  }
  if (planKey === 'pro') {
    return { icon: Crown, className: 'text-slate-700' };
  }
  return { icon: Gift, className: 'text-teal-600' };
}

export type PlanWhySection = {
  heading: string;
  bullets: readonly string[];
  footnote?: string;
};

const PLAN_WHY_SECTIONS: Record<string, PlanWhySection> = {
  free: {
    heading: 'Why Free?',
    bullets: [
      'Test your first AI agent',
      'Add basic knowledge',
      'Capture leads',
      'Try voice, dictation, and sharing',
      'Good for early validation',
    ],
  },
  starter: {
    heading: 'Why Starter?',
    bullets: [
      '10x more AI credits than Free',
      '3x more trained knowledge storage',
      'Unlimited analytics history',
      'Export reports and leads',
      'Better for real customer conversations',
    ],
  },
  pro: {
    heading: 'Why Pro?',
    bullets: [
      '2,000 AI credits/month',
      '25 MB trained knowledge storage',
      '10 workspace members',
      'Priority support',
      'Best for larger teams and higher traffic',
    ],
  },
};

export function planPricingCardWhySection(planKey: string): PlanWhySection {
  const base = PLAN_WHY_SECTIONS[planKey] ?? PLAN_WHY_SECTIONS.free;
  const { items, footnote } = planPricingCardDescriptionDisplay(planKey);
  const seen = new Set<string>();

  const bullets = [...items, ...base.bullets].filter((bullet) => {
    if (seen.has(bullet)) return false;
    seen.add(bullet);
    return true;
  });

  return { heading: base.heading, bullets, footnote };
}

export function planFeatureHeading(planKey: string): string {
  if (planKey === 'starter') return 'Everything in Free +';
  if (planKey === 'pro') return 'Everything in Starter +';
  return 'Free includes';
}

export function planFeatureIntro(planKey: string): string | undefined {
  if (planKey === 'free') {
    return 'Same core features as paid plans, with lower monthly limits.';
  }
  if (planKey === 'starter') {
    return 'More capacity and exports so features keep working day to day.';
  }
  if (planKey === 'pro') {
    return 'Highest limits for teams that need uninterrupted scale.';
  }
  return undefined;
}

export function planFeatureFootnote(planKey: string): string | undefined {
  if (planKey === 'free') {
    return 'Trial credits do not renew. Your 7-day trial includes 50 trial credits total. When the trial ends or credits run out, upgrade to keep using AI chat and paid-plan features.';
  }
  return undefined;
}

export function isRecommendedPlan(planKey: string): boolean {
  return planKey === 'pro';
}

function analyticsWindowLabel(days: number | null | undefined): string {
  if (days == null) return 'Unlimited history';
  return `${days} days history`;
}

/** Core limit lines shown on each pricing card. */
export function buildPlanCardLimitItems(plan: WorkspaceBillingPlanCatalogCard): PlanChecklistItem[] {
  const analyticsWindow = analyticsWindowLabel(plan.analyticsHistoryDays);

  const creditsLabel =
    plan.key === 'free'
      ? `${plan.monthlyAiCredits.toLocaleString()} trial credits total`
      : `${plan.monthlyAiCredits.toLocaleString()} AI credits / month`;

  return [
    { label: `${plan.botLimit} agent${plan.botLimit === 1 ? '' : 's'}`, included: true },
    {
      label: plan.key === 'free' ? 'Owner only (no invites)' : `${plan.memberLimit} members`,
      included: plan.key !== 'free',
    },
    { label: creditsLabel, included: true },
    { label: `${plan.kbStorageMbPerBot} MB trained knowledge / bot`, included: true },
    { label: analyticsWindow, included: true },
  ];
}

/** @deprecated Use buildPlanCardLimitItems instead. */
export function buildPlanCardFeatures(plan: WorkspaceBillingPlanCatalogCard): PlanCardFeatures {
  return {
    heading: planFeatureHeading(plan.key),
    intro: planFeatureIntro(plan.key),
    footnote: planFeatureFootnote(plan.key),
    sections: [{ subheading: 'Limits', items: buildPlanCardLimitItems(plan) }],
  };
}

/** @deprecated Use buildPlanCardLimitItems instead. */
export function buildPlanChecklistGroups(plan: WorkspaceBillingPlanCatalogCard) {
  const items = buildPlanCardLimitItems(plan);
  return { limits: items, features: [] };
}

/** @deprecated Use buildPlanCardLimitItems instead. */
export function buildPlanChecklistItems(plan: WorkspaceBillingPlanCatalogCard): PlanChecklistItem[] {
  return buildPlanCardLimitItems(plan);
}
