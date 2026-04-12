"use client";

import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import { PRIMARY_NAV_CTA_LABEL, TRY_SHOWCASE_CTA_LABEL } from "@/lib/primary-cta-label";

const LOCATION = "home_hero";

/**
 * Hero CTAs — contact only, plus opening the showcase chat panel (no other marketing routes).
 */
export function HeroCtaCluster() {
  return (
    <div className="max-w-lg">
      <TrackedCtaLink
        href="/contact"
        location={`${LOCATION}_contact`}
        label={PRIMARY_NAV_CTA_LABEL}
        variant="primary"
        className="btn-primary-shimmer relative w-full justify-center overflow-hidden rounded-2xl px-6 py-4 text-[0.9375rem] font-semibold shadow-[var(--shadow-md)] ring-2 ring-[color-mix(in_srgb,var(--brand-teal)_22%,transparent)] transition-[transform,box-shadow] duration-200 hover:scale-[1.01] hover:shadow-[0_16px_44px_-12px_rgba(13,148,136,0.35)] active:scale-[0.99] sm:text-base"
      >
        Contact us
      </TrackedCtaLink>

      <div className="mt-3">
        <TrackedFlowCtaButton
          flow="showcase"
          href="#live-demos"
          location={`${LOCATION}_showcase`}
          label={TRY_SHOWCASE_CTA_LABEL}
          variant="secondary"
          className="w-full justify-center rounded-2xl border border-[var(--border-default)] bg-white/70 px-5 py-3.5 text-[0.9375rem] font-semibold text-slate-700 shadow-[var(--shadow-xs)] backdrop-blur-sm transition-[transform,box-shadow,background-color,border-color] duration-200 hover:border-[var(--border-teal-soft)] hover:bg-[color-mix(in_srgb,var(--brand-teal-subtle)_78%,white)] hover:shadow-[var(--shadow-md)] active:translate-y-0"
        >
          {TRY_SHOWCASE_CTA_LABEL}
        </TrackedFlowCtaButton>
      </div>

      <p className="mt-4 text-pretty text-[0.8125rem] leading-relaxed text-[var(--foreground-muted)]">
        Open a curated showcase agent and chat on this site, or send us a message — that&apos;s all you can do here.
      </p>
    </div>
  );
}
