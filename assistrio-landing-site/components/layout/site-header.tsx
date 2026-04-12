"use client";

import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { SITE_LOGO, SITE_LOGO_WORDMARK_PX } from "@/lib/site-branding";
import { PRIMARY_NAV_CTA_LABEL, PRIMARY_NAV_CTA_LINE } from "@/lib/primary-cta-label";

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
          <TrackedCtaLink
            href="/contact"
            location="site_header"
            label={PRIMARY_NAV_CTA_LABEL}
            variant="primary"
            className="btn-primary-shimmer max-w-[min(92vw,14.5rem)] rounded-full px-2.5 py-2 text-center text-[0.65rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:max-w-none sm:px-4 sm:py-2.5 sm:text-sm"
          >
            {PRIMARY_NAV_CTA_LINE}
          </TrackedCtaLink>
        </nav>
      </Container>
    </header>
  );
}
