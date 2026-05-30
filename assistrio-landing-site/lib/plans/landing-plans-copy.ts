export const LANDING_PLANS_PAGE = {
  eyebrow: "Pricing",
  title: "Plans that grow with you",
  lead: "Start with a 7-day free trial, then move to Starter or Pro when you need more AI credits, storage, and teammates.",
  comparisonTitle: "What each plan includes",
  comparisonSubtitle: "Compare limits and features across Free, Starter, and Pro.",
  addonsTitle: "Add-ons",
  addonsSubtitle: "Optional extras you can add from your workspace after you subscribe to a paid plan.",
  addonAvailabilityNote: "Available on Starter and Pro after you sign up.",
} as const;

export function landingPlanCardActionLabel(planKey: string): string {
  if (planKey === "free") return "Start free trial";
  if (planKey === "starter") return "Get started";
  if (planKey === "pro") return "Get started";
  return "Get started";
}

/** Plan card CTA chrome on the marketing /plans page. */
export function landingPlanCardButtonClassName(planKey: string, enabled: boolean): string {
  const base = "h-11 w-full min-w-full rounded-xl text-sm font-semibold transition-[transform,box-shadow] duration-200 active:scale-[0.99]";
  if (!enabled) {
    return `${base} cursor-not-allowed opacity-50`;
  }
  if (planKey === "free") {
    return `${base} border-2 border-[var(--brand-teal)] bg-white text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)] hover:bg-[color-mix(in_srgb,var(--brand-teal-subtle)_70%,white)] hover:shadow-[var(--shadow-md)]`;
  }
  return `${base} btn-primary-shimmer border-transparent bg-[var(--brand-teal)] text-white shadow-[var(--shadow-sm)] ring-1 ring-white/15 hover:brightness-[1.02]`;
}
