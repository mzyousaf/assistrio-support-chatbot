"use client";

import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { SITE_LOGO, SITE_LOGO_WORDMARK_PX } from "@/lib/site-branding";
import {
  GALLERY_CTA_NAV_LABEL,
  TRIAL_NAV_PRIMARY_LINE,
  TRIAL_NAV_STACK_LABEL,
} from "@/lib/trial-primary-cta-label";

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

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-white/92 shadow-[var(--shadow-xs)] backdrop-blur-md supports-[backdrop-filter]:bg-white/78">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)]/40 to-transparent" aria-hidden />
      <Container className="flex min-h-14 min-w-0 items-center justify-between gap-2 sm:h-16 sm:gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 transition-opacity duration-150 hover:opacity-85 sm:gap-3"
        >
          <Image
            src={SITE_LOGO.sm}
            alt=""
            width={36}
            height={36}
            className="h-8 w-8 shrink-0 rounded-lg object-contain sm:h-9 sm:w-9"
            priority
            aria-hidden
          />
          <Image
            src={SITE_LOGO.wordmark}
            alt="Assistrio"
            width={SITE_LOGO_WORDMARK_PX.width}
            height={SITE_LOGO_WORDMARK_PX.height}
            className="h-5 w-auto max-w-[min(44vw,7.25rem)] object-contain object-left sm:h-[22px] sm:max-w-[8.5rem]"
            priority
          />
        </Link>

        <nav
          aria-label="Primary actions"
          className="flex min-w-0 shrink flex-wrap items-center justify-end gap-2 sm:gap-3"
        >
          <TrackedFlowCtaButton
            flow="trial"
            href="/trial"
            location="site_header"
            label={TRIAL_NAV_STACK_LABEL}
            variant="primary"
            className="btn-primary-shimmer max-w-[min(92vw,14.5rem)] rounded-full px-2.5 py-2 text-center text-[0.65rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:max-w-none sm:px-4 sm:py-2.5 sm:text-sm"
          >
            {TRIAL_NAV_PRIMARY_LINE}
          </TrackedFlowCtaButton>
          <GalleryNavLink />
        </nav>
      </Container>
    </header>
  );
}
