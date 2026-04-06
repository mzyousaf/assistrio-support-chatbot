"use client";

import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";

export function HomeLiveDemosCta() {
  return (
    <TrackedCtaLink
      href="/gallery"
      location="home_live_demos"
      label="Live AI Agents"
      className="btn-primary-shimmer w-full shrink-0 justify-center px-7 py-3.5 text-[0.9375rem] sm:w-auto sm:px-9 sm:text-base"
    >
      Live AI Agents
    </TrackedCtaLink>
  );
}
