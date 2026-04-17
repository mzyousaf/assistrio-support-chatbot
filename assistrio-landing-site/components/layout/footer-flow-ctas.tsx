"use client";

import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { TrackedExternalCtaLink } from "@/components/analytics/tracked-external-cta-link";
import { useLandingCustomerSession } from "@/contexts/landing-customer-session-context";
import {
  CONTINUE_WITH_GOOGLE_CTA_LABEL,
  CONTINUE_WITH_GOOGLE_CTA_LINE,
  OPEN_CUSTOMER_APP_CTA_LABEL,
  OPEN_CUSTOMER_APP_CTA_LINE,
  PRIMARY_NAV_CTA_LABEL,
  PRIMARY_NAV_CTA_LINE,
} from "@/lib/primary-cta-label";

/** Footer — session-aware product entry plus contact. */
export function FooterFlowCtas() {
  const { status, googleAuthStartUrl, customerAppEntryUrl, apiBaseUrl } = useLandingCustomerSession();
  const showGoogle = Boolean(apiBaseUrl && googleAuthStartUrl);
  const showOpenApp = Boolean(customerAppEntryUrl);

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {status === "loading" ? (
        <span className="max-w-full rounded-full border border-[var(--border-default)] bg-white/70 px-3 py-2.5 text-center text-[0.8125rem] font-medium text-slate-500 sm:px-4 sm:text-sm">
          Checking account…
        </span>
      ) : status === "authenticated" && showOpenApp ? (
        <TrackedExternalCtaLink
          href={customerAppEntryUrl!}
          location="site_footer_open_app"
          label={OPEN_CUSTOMER_APP_CTA_LABEL}
          variant="primary"
          className="btn-primary-shimmer max-w-full justify-center rounded-full px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:px-4 sm:text-sm"
        >
          {OPEN_CUSTOMER_APP_CTA_LINE}
        </TrackedExternalCtaLink>
      ) : status !== "authenticated" && showGoogle ? (
        <TrackedExternalCtaLink
          href={googleAuthStartUrl!}
          location="site_footer_google"
          label={CONTINUE_WITH_GOOGLE_CTA_LABEL}
          variant="primary"
          className="btn-primary-shimmer max-w-full justify-center rounded-full px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:px-4 sm:text-sm"
        >
          {CONTINUE_WITH_GOOGLE_CTA_LINE}
        </TrackedExternalCtaLink>
      ) : null}
      <TrackedCtaLink
        href="/contact"
        location="site_footer"
        label={PRIMARY_NAV_CTA_LABEL}
        variant={status === "authenticated" || showGoogle ? "secondary" : "primary"}
        className={
          status === "authenticated" || showGoogle
            ? "max-w-full justify-center rounded-full border border-[var(--border-default)] bg-white/80 px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug text-slate-700 shadow-[var(--shadow-xs)] sm:px-4 sm:text-sm"
            : "btn-primary-shimmer max-w-full justify-center rounded-full px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:px-4 sm:text-sm"
        }
      >
        {PRIMARY_NAV_CTA_LINE}
      </TrackedCtaLink>
    </div>
  );
}
