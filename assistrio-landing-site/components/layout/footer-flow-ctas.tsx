"use client";

import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { PRIMARY_NAV_CTA_LABEL, PRIMARY_NAV_CTA_LINE } from "@/lib/primary-cta-label";

/** Footer primary action — contact only. */
export function FooterFlowCtas() {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      <TrackedCtaLink
        href="/contact"
        location="site_footer"
        label={PRIMARY_NAV_CTA_LABEL}
        variant="primary"
        className="btn-primary-shimmer max-w-full justify-center rounded-full px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:px-4 sm:text-sm"
      >
        {PRIMARY_NAV_CTA_LINE}
      </TrackedCtaLink>
    </div>
  );
}
