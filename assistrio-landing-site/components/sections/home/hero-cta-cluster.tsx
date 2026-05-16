"use client";

import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { TrackedExternalCtaLink } from "@/components/analytics/tracked-external-cta-link";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import { useLandingCustomerSession } from "@/contexts/landing-customer-session-context";
import {
  CONTINUE_WITH_GOOGLE_CTA_LABEL,
  CONTINUE_WITH_GOOGLE_CTA_LINE,
  OPEN_CUSTOMER_APP_CTA_LABEL,
  OPEN_CUSTOMER_APP_CTA_LINE,
  PRIMARY_NAV_CTA_LABEL,
  TRY_SHOWCASE_CTA_LABEL,
} from "@/lib/primary-cta-label";

const LOCATION = "home_hero";

const primaryHeroClass =
  "btn-primary-shimmer relative w-full justify-center overflow-hidden rounded-2xl px-6 py-4 text-[0.9375rem] font-semibold shadow-[var(--shadow-md)] ring-2 ring-[color-mix(in_srgb,var(--brand-teal)_22%,transparent)] transition-[transform,box-shadow] duration-200 hover:scale-[1.01] hover:shadow-[0_16px_44px_-12px_rgba(13,148,136,0.35)] active:scale-[0.99] sm:text-base";

const secondaryHeroClass =
  "w-full justify-center rounded-2xl border border-[var(--border-default)] bg-white/70 px-5 py-3.5 text-[0.9375rem] font-semibold text-slate-700 shadow-[var(--shadow-xs)] backdrop-blur-sm transition-[transform,box-shadow,background-color,border-color] duration-200 hover:border-[var(--border-teal-soft)] hover:bg-[color-mix(in_srgb,var(--brand-teal-subtle)_78%,white)] hover:shadow-[var(--shadow-md)] active:translate-y-0";

/**
 * Hero CTAs — session-aware product entry (Google / Open app), live demo, and contact.
 */
export function HeroCtaCluster() {
  const { status, googleAuthStartUrl, customerAppEntryUrl, apiBaseUrl, sessionProbeError } =
    useLandingCustomerSession();

  const showGoogle = Boolean(apiBaseUrl && googleAuthStartUrl);
  const showOpenApp = Boolean(customerAppEntryUrl);
  const misconfiguredApp = status === "authenticated" && !customerAppEntryUrl;

  return (
    <div className="max-w-lg">
      {status === "loading" ? (
        <div
          className={`${primaryHeroClass} pointer-events-none opacity-70`}
          aria-busy
          aria-live="polite"
        >
          Checking account…
        </div>
      ) : status === "authenticated" ? (
        showOpenApp ? (
          <TrackedExternalCtaLink
            href={customerAppEntryUrl!}
            location={`${LOCATION}_open_app`}
            label={OPEN_CUSTOMER_APP_CTA_LABEL}
            variant="primary"
            className={primaryHeroClass}
          >
            {OPEN_CUSTOMER_APP_CTA_LINE}
          </TrackedExternalCtaLink>
        ) : (
          <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[0.8125rem] leading-relaxed text-amber-950">
            You&apos;re signed in. Set <code className="rounded bg-white/80 px-1">NEXT_PUBLIC_CUSTOMER_APP_URL</code>{" "}
            on the marketing site to show the &quot;Open app&quot; button.
          </p>
        )
      ) : showGoogle ? (
        <TrackedExternalCtaLink
          href={googleAuthStartUrl!}
          location={`${LOCATION}_google`}
          label={CONTINUE_WITH_GOOGLE_CTA_LABEL}
          variant="primary"
          className={primaryHeroClass}
        >
          {CONTINUE_WITH_GOOGLE_CTA_LINE}
        </TrackedExternalCtaLink>
      ) : (
        <TrackedCtaLink
          href="/contact"
          location={`${LOCATION}_contact_fallback`}
          label={PRIMARY_NAV_CTA_LABEL}
          variant="primary"
          className={primaryHeroClass}
        >
          Contact us
        </TrackedCtaLink>
      )}

      <div className="mt-3">
        <TrackedFlowCtaButton
          flow="showcase"
          href="#live-demos"
          location={`${LOCATION}_showcase`}
          label={TRY_SHOWCASE_CTA_LABEL}
          variant="secondary"
          className={secondaryHeroClass}
        >
          {TRY_SHOWCASE_CTA_LABEL}
        </TrackedFlowCtaButton>
      </div>

      <div className="mt-3">
        <TrackedCtaLink
          href="/contact"
          location={`${LOCATION}_contact`}
          label={PRIMARY_NAV_CTA_LABEL}
          variant="secondary"
          className={`${secondaryHeroClass} border-dashed`}
        >
          Contact us
        </TrackedCtaLink>
      </div>

      {sessionProbeError ? (
        <p className="mt-3 text-pretty text-[0.75rem] leading-relaxed text-amber-800/90">
          Could not verify sign-in status ({sessionProbeError}). You can still use the demo or contact us.
        </p>
      ) : null}
      {misconfiguredApp ? null : (
        <p className="mt-4 text-pretty text-[0.8125rem] leading-relaxed text-[var(--foreground-muted)]">
          {status === "authenticated"
            ? "Pick up where you left off in your workspace, try a curated demo on this page, or reach out if you want a walkthrough."
            : "Create your workspace with Google, try a curated showcase agent on this site, or send us a message — no separate marketing-only signup flow."}
        </p>
      )}
    </div>
  );
}
