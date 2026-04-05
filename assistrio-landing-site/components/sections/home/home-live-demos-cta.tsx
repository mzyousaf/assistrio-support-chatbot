"use client";

import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";

export function HomeLiveDemosCta() {
  return (
    <TrackedFlowCtaButton
      flow="showcase"
      href="/gallery"
      location="home_live_demos"
      label="See Live Examples"
      className="btn-primary-shimmer w-full shrink-0 justify-center px-7 py-3.5 text-[0.9375rem] sm:w-auto sm:px-9 sm:text-base"
    >
      See Live Examples
    </TrackedFlowCtaButton>
  );
}
