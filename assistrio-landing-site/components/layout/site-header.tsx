"use client";

import Link from "next/link";
import { Container } from "@/components/layout/container";
import { SiteBrandLogoLink } from "@/components/layout/site-brand-logo";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import { TrialSessionAccountMenu } from "@/components/trial/trial-session-account-menu";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import type { TrialSessionClientPayload } from "@/lib/trial/trial-session-display";
import {
  GALLERY_CTA_NAV_LABEL,
  TRIAL_NAV_PRIMARY_LINE,
  TRIAL_NAV_STACK_LABEL,
} from "@/lib/trial-primary-cta-label";

/** Primary CTA when the visitor has not started a trial session (marketing site). */
const trialPrimaryNavClassName =
  "btn-primary-shimmer max-w-[min(92vw,14.5rem)] rounded-full px-2.5 py-2 text-center text-[0.65rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:max-w-none sm:px-4 sm:py-2.5 sm:text-sm";

/** Gallery CTA — hidden below `sm`; mobile nav shows only the trial button. */
function GalleryNavLink() {
  const { track } = useTrackEvent();
  return (
    <Link
      href="/gallery"
      onClick={() => track("cta_clicked", { location: "site_header", label: GALLERY_CTA_NAV_LABEL, href: "/gallery" })}
      className="hidden items-center justify-center rounded-full border border-[var(--border-teal-soft)] bg-white px-4 py-2 text-center text-sm font-semibold leading-normal text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)] transition-[color,background-color,box-shadow,border-color,transform] duration-[240ms] hover:border-[var(--brand-teal)]/45 hover:bg-[var(--brand-teal-subtle)]/85 hover:shadow-[var(--shadow-md)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]/50 sm:inline-flex"
    >
      {GALLERY_CTA_NAV_LABEL}
    </Link>
  );
}

type SiteHeaderProps = {
  trialSessionClient?: TrialSessionClientPayload | null;
};

export function SiteHeader({ trialSessionClient = null }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-white/92 shadow-[var(--shadow-xs)] backdrop-blur-md supports-[backdrop-filter]:bg-white/78">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)]/40 to-transparent" aria-hidden />
      <Container className="flex min-h-14 min-w-0 items-center justify-between gap-2 sm:h-16 sm:gap-4">
        <SiteBrandLogoLink title="Assistrio — marketing site home" />

        <nav
          aria-label="Primary actions"
          className="flex min-w-0 shrink flex-wrap items-center justify-end gap-2 sm:gap-3"
        >
          {!trialSessionClient ? (
            <>
              <TrackedFlowCtaButton
                flow="trial"
                href="/trial"
                location="site_header"
                label={TRIAL_NAV_STACK_LABEL}
                variant="primary"
                className={trialPrimaryNavClassName}
              >
                {TRIAL_NAV_PRIMARY_LINE}
              </TrackedFlowCtaButton>
              <GalleryNavLink />
            </>
          ) : (
            <TrialSessionAccountMenu session={trialSessionClient} variant="header" />
          )}
        </nav>
      </Container>
    </header>
  );
}
