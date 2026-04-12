"use client";

import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import { TRY_SHOWCASE_CTA_LABEL } from "@/lib/primary-cta-label";

export function HomeLiveDemosCta() {
  return (
    <TrackedFlowCtaButton
      flow="showcase"
      href="#live-demos"
      location="home_live_demos"
      label={TRY_SHOWCASE_CTA_LABEL}
      className="btn-primary-shimmer w-full shrink-0 justify-center px-7 py-3.5 text-[0.9375rem] sm:w-auto sm:px-9 sm:text-base"
    >
      {TRY_SHOWCASE_CTA_LABEL}
    </TrackedFlowCtaButton>
  );
}
