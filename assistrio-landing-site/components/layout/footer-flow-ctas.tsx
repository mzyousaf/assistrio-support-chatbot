"use client";

import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";

/** Try it free + See Live Examples — same actions as the site header, for footer (and optional reuse). */
export function FooterFlowCtas() {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      <TrackedFlowCtaButton
        flow="trial"
        href="/trial"
        location="site_footer"
        label="Try it free"
        variant="secondary"
        className="justify-center rounded-full border border-[var(--border-teal-soft)] px-4 py-2 text-sm font-semibold shadow-[var(--shadow-xs)]"
      >
        Try it free
      </TrackedFlowCtaButton>
      <TrackedFlowCtaButton
        flow="showcase"
        href="/gallery"
        location="site_footer"
        label="See Live Examples"
        variant="secondary"
        className="justify-center rounded-full border border-[var(--border-default)] bg-slate-50/90 px-4 py-2 text-sm font-semibold text-slate-800"
      >
        See Live Examples
      </TrackedFlowCtaButton>
    </div>
  );
}
