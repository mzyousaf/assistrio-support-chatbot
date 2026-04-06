"use client";

import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import { TRIAL_NO_CREDIT_CARD_NOTE, TRIAL_PRIMARY_CTA_LABEL } from "@/lib/trial-primary-cta-label";

export function HomeIdentityTrialCta() {
  return (
    <div className="flex flex-col gap-1.5">
      <TrackedFlowCtaButton
        flow="trial"
        href="/trial"
        location="home_identity_trial"
        label={TRIAL_PRIMARY_CTA_LABEL}
        className="btn-primary-shimmer px-7 py-3 text-center text-sm leading-snug sm:text-base"
      >
        {TRIAL_PRIMARY_CTA_LABEL}
      </TrackedFlowCtaButton>
      <p className="text-emphasis-primary text-[0.75rem] leading-snug">{TRIAL_NO_CREDIT_CARD_NOTE}</p>
    </div>
  );
}
