"use client";

import Link from "next/link";
import { useCtaFlow } from "@/components/flows/cta-flow-context";
import { Button, ButtonLink } from "@/components/ui/button";
import type { TrialVerifyReasonKey } from "@/lib/trial/trial-verify-reasons";

const VERIFY_CTA_LOCATION = "trial_verify";

/** Squarer corners than default marketing buttons (`rounded-[var(--radius-lg)]`). */
const verifyCtaButtonClass = "rounded-md";

const homeLinkClass =
  "text-sm font-semibold text-[var(--brand-teal)] underline decoration-[var(--brand-teal)] underline-offset-4 transition-colors hover:text-[var(--brand-teal-hover)] hover:decoration-[var(--brand-teal-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]";

type Props = {
  reasonKey: TrialVerifyReasonKey;
};

function GoToHomeLink() {
  return (
    <Link href="/" className={homeLinkClass}>
      Go to homepage
    </Link>
  );
}

/**
 * Single place for verify failure CTAs: expired → workspace link; used / invalid / other → same {@link TrialFlowModal} via {@link useCtaFlow}.
 */
export function TrialVerifyFailureActions({ reasonKey }: Props) {
  const { openTrial } = useCtaFlow();

  const openSessionModal = (label: string) => {
    openTrial({
      label,
      location: VERIFY_CTA_LOCATION,
      href: "/trial/verify",
    });
  };

  if (reasonKey === "expired") {
    return (
      <div className="mt-8 flex w-full flex-col items-center gap-4">
        <ButtonLink
          href="/trial/dashboard"
          variant="primary"
          className={`w-full max-w-sm justify-center sm:w-auto ${verifyCtaButtonClass}`}
        >
          Continue to workspace
        </ButtonLink>
        <GoToHomeLink />
      </div>
    );
  }

  if (reasonKey === "used") {
    return (
      <div className="mt-8 flex w-full flex-col items-center gap-4">
        <Button
          type="button"
          variant="primary"
          className={`w-full max-w-sm justify-center sm:w-auto ${verifyCtaButtonClass}`}
          onClick={() => openSessionModal("Send me a new link")}
        >
          Send me a new link
        </Button>
        <GoToHomeLink />
      </div>
    );
  }

  return (
    <div className="mt-8 flex w-full flex-col items-center gap-4">
      <Button
        type="button"
        variant="primary"
        className={`w-full max-w-sm justify-center sm:w-auto ${verifyCtaButtonClass}`}
        onClick={() => openSessionModal("Request a new access link")}
      >
        Request a new access link
      </Button>
      <GoToHomeLink />
    </div>
  );
}
