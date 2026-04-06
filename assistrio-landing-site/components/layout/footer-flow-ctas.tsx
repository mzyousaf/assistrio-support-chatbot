"use client";

import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import {
  GALLERY_CTA_NAV_LABEL,
  TRIAL_NAV_PRIMARY_LINE,
  TRIAL_NAV_STACK_LABEL,
} from "@/lib/trial-primary-cta-label";

/** Trial (combined CTA) + gallery link — same actions as the site header, for footer (and optional reuse). */
export function FooterFlowCtas() {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      <TrackedFlowCtaButton
        flow="trial"
        href="/trial"
        location="site_footer"
        label={TRIAL_NAV_STACK_LABEL}
        variant="primary"
        className="btn-primary-shimmer max-w-full justify-center rounded-full px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:px-4 sm:text-sm"
      >
        {TRIAL_NAV_PRIMARY_LINE}
      </TrackedFlowCtaButton>
      <TrackedCtaLink
        href="/gallery"
        location="site_footer"
        label={GALLERY_CTA_NAV_LABEL}
        variant="secondary"
        className="justify-center rounded-full border border-[var(--border-teal-soft)] px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug shadow-[var(--shadow-xs)] sm:px-4 sm:text-sm sm:leading-normal"
      >
        {GALLERY_CTA_NAV_LABEL}
      </TrackedCtaLink>
    </div>
  );
}
