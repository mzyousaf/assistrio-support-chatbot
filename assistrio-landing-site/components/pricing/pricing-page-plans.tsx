"use client";

import { PlansPricingGrid } from "@/components/sections/home/plans-pricing-grid";
import { PRICING_PAGE_PLANS } from "@/lib/pricing-content";

export function PricingPagePlansGrid() {
  return <PlansPricingGrid plans={PRICING_PAGE_PLANS} density="comfortable" trackLocation="pricing_page" />;
}
