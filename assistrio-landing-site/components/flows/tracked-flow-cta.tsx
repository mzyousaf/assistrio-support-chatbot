"use client";

import type { ReactNode } from "react";
import { buttonBaseClass, buttonVariantClass, type ButtonVariant } from "@/components/ui/button";
import { useCtaFlow } from "@/components/flows/cta-flow-context";
import { useTrackEvent } from "@/hooks/useTrackEvent";

type Props = {
  flow: "trial" | "showcase";
  /** For analytics — canonical path the CTA replaces */
  href: string;
  location: string;
  label: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
  /** When opening showcase, jump to this bot if present in the public list */
  showcaseSlug?: string | null;
};

export function TrackedFlowCtaButton({
  flow,
  href,
  location,
  label,
  variant = "primary",
  className = "",
  children,
  showcaseSlug,
}: Props) {
  const { openTrial, openShowcase } = useCtaFlow();
  const { track } = useTrackEvent();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => {
        track("cta_clicked", { location, label, href });
        if (flow === "trial") openTrial();
        else openShowcase(showcaseSlug ?? undefined);
      }}
      className={`${buttonBaseClass} ${buttonVariantClass[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
