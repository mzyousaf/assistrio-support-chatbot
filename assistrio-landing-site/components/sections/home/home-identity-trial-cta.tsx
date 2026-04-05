"use client";

import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";

export function HomeIdentityTrialCta() {
  return (
    <TrackedFlowCtaButton
      flow="trial"
      href="/trial"
      location="home_identity_trial"
      label="Try it free"
      className="btn-primary-shimmer px-7 py-3 text-sm sm:text-base"
    >
      Try it free
    </TrackedFlowCtaButton>
  );
}
