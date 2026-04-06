"use client";

import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";
import { TRIAL_NO_CREDIT_CARD_NOTE, TRIAL_PRIMARY_CTA_LABEL } from "@/lib/trial-primary-cta-label";

const LOCATION = "home_hero";

/**
 * Hero CTAs — one strong primary action, secondary actions as a calm row (avoids three competing cards).
 */
export function HeroCtaCluster() {
  return (
    <div className="max-w-lg">
      <TrackedCtaLink
        href="/contact"
        location={`${LOCATION}_hosted`}
        label="Go live with Assistrio"
        variant="primary"
        className="btn-primary-shimmer relative w-full justify-center overflow-hidden rounded-2xl px-6 py-4 text-[0.9375rem] font-semibold shadow-[var(--shadow-md)] ring-2 ring-[color-mix(in_srgb,var(--brand-teal)_22%,transparent)] transition-[transform,box-shadow] duration-200 hover:scale-[1.01] hover:shadow-[0_16px_44px_-12px_rgba(13,148,136,0.35)] active:scale-[0.99] sm:text-base"
      >
        Go live with Assistrio
      </TrackedCtaLink>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <TrackedFlowCtaButton
          flow="trial"
          href="/trial"
          location={`${LOCATION}_explore`}
          label={TRIAL_PRIMARY_CTA_LABEL}
          variant="secondary"
          className="w-full justify-center rounded-2xl border border-[var(--border-default)] bg-white/70 px-5 py-3.5 text-[0.9375rem] font-semibold text-slate-700 shadow-[var(--shadow-xs)] backdrop-blur-sm transition-[transform,box-shadow,background-color,border-color] duration-200 hover:border-[var(--border-teal-soft)] hover:bg-[color-mix(in_srgb,var(--brand-teal-subtle)_78%,white)] hover:shadow-[var(--shadow-md)] active:translate-y-0"
        >
          {TRIAL_PRIMARY_CTA_LABEL}
        </TrackedFlowCtaButton>
        <TrackedCtaLink
          href="/gallery"
          location={`${LOCATION}_examples`}
          label="Live AI Agents"
          variant="secondary"
          className="w-full justify-center rounded-2xl border border-[var(--border-default)] bg-white/70 px-5 py-3.5 text-[0.9375rem] font-semibold text-slate-700 shadow-[var(--shadow-xs)] backdrop-blur-sm transition-[transform,box-shadow,background-color,border-color] duration-200 hover:border-[var(--border-teal-soft)] hover:bg-[color-mix(in_srgb,var(--brand-teal-subtle)_78%,white)] hover:shadow-[var(--shadow-md)] active:translate-y-0"
        >
          Live AI Agents
        </TrackedCtaLink>
      </div>

      <p className="mt-4 text-pretty text-[0.8125rem] leading-relaxed text-[var(--foreground-muted)]">
        Try it free on your website — <span className="text-emphasis-primary">{TRIAL_NO_CREDIT_CARD_NOTE}</span>. Live AI
        Support Agents in the gallery are instant. Launch is fully hosted when you are ready.
      </p>
    </div>
  );
}
