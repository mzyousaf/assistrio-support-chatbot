"use client";

import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { TrackedExternalCtaLink } from "@/components/analytics/tracked-external-cta-link";
import { useLandingCustomerSession } from "@/contexts/landing-customer-session-context";
import { SITE_LOGO, SITE_LOGO_WORDMARK_PX } from "@/lib/site-branding";
import {
  CONTINUE_WITH_GOOGLE_CTA_LABEL,
  CONTINUE_WITH_GOOGLE_CTA_LINE,
  OPEN_CUSTOMER_APP_CTA_LABEL,
  OPEN_CUSTOMER_APP_CTA_LINE,
  PRIMARY_NAV_CTA_LABEL,
  PRIMARY_NAV_CTA_LINE,
} from "@/lib/primary-cta-label";

export function SiteHeader() {
  const { status, googleAuthStartUrl, customerAppEntryUrl, apiBaseUrl } = useLandingCustomerSession();
  const showGoogle = Boolean(apiBaseUrl && googleAuthStartUrl);
  const showOpenApp = Boolean(customerAppEntryUrl);

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
          {status === "loading" ? (
            <span className="rounded-full border border-[var(--border-default)] bg-white/70 px-3 py-2 text-[0.65rem] font-medium text-slate-500 sm:px-4 sm:py-2.5 sm:text-sm">
              …
            </span>
          ) : status === "authenticated" && showOpenApp ? (
            <TrackedExternalCtaLink
              href={customerAppEntryUrl!}
              location="site_header_open_app"
              label={OPEN_CUSTOMER_APP_CTA_LABEL}
              variant="primary"
              className="btn-primary-shimmer max-w-[min(92vw,14.5rem)] rounded-full px-2.5 py-2 text-center text-[0.65rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:max-w-none sm:px-4 sm:py-2.5 sm:text-sm"
            >
              {OPEN_CUSTOMER_APP_CTA_LINE}
            </TrackedExternalCtaLink>
          ) : status !== "authenticated" && showGoogle ? (
            <TrackedExternalCtaLink
              href={googleAuthStartUrl!}
              location="site_header_google"
              label={CONTINUE_WITH_GOOGLE_CTA_LABEL}
              variant="primary"
              className="btn-primary-shimmer max-w-[min(92vw,14.5rem)] rounded-full px-2.5 py-2 text-center text-[0.65rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:max-w-none sm:px-4 sm:py-2.5 sm:text-sm"
            >
              {CONTINUE_WITH_GOOGLE_CTA_LINE}
            </TrackedExternalCtaLink>
          ) : null}
          <TrackedCtaLink
            href="/contact"
            location="site_header"
            label={PRIMARY_NAV_CTA_LABEL}
            variant={status === "authenticated" || showGoogle ? "secondary" : "primary"}
            className={
              status === "authenticated" || showGoogle
                ? "max-w-[min(92vw,14.5rem)] rounded-full border border-[var(--border-default)] bg-white/80 px-2.5 py-2 text-center text-[0.65rem] font-semibold leading-snug text-slate-700 shadow-[var(--shadow-xs)] sm:max-w-none sm:px-4 sm:py-2.5 sm:text-sm"
                : "btn-primary-shimmer max-w-[min(92vw,14.5rem)] rounded-full px-2.5 py-2 text-center text-[0.65rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:max-w-none sm:px-4 sm:py-2.5 sm:text-sm"
            }
          >
            {PRIMARY_NAV_CTA_LINE}
          </TrackedCtaLink>
        </nav>
      </Container>
    </header>
  );
}
