"use client";

import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";

const LOCATION = "home_final_cta";

const microClass =
  "text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]";
const hintClass = "text-[0.8125rem] leading-snug text-[var(--foreground-muted)]";

/**
 * Closing homepage CTAs — three equal-height choice cards (clearer than stacked divider rows).
 */
export function FinalCtaRow() {
  return (
    <div className="mt-10 w-full sm:mt-12">
      <p
        className="mb-5 text-center text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)] lg:mb-6"
        id="final-cta-paths-label"
      >
        Choose a path
      </p>

      <ul
        className="grid list-none grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6"
        aria-labelledby="final-cta-paths-label"
      >
        <li className="min-w-0">
          <div className="flex h-full flex-col rounded-2xl border-2 border-[color-mix(in_srgb,var(--brand-teal)_38%,transparent)] bg-[color-mix(in_srgb,var(--brand-teal-subtle)_30%,white)] p-5 shadow-[0_20px_50px_-28px_rgba(13,148,136,0.35)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_14%,transparent)] sm:p-6">
            <span className="inline-flex w-fit rounded-full bg-white/80 px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)] ring-1 ring-[var(--border-teal-soft)]">
              Most teams start here
            </span>
            <p className={`${microClass} mt-4 text-[var(--brand-teal-dark)]`}>Production launch</p>
            <TrackedCtaLink
              href="/contact"
              location={`${LOCATION}_hosted`}
              label="Go live with Assistrio"
              variant="primary"
              className="btn-primary-shimmer mt-3 w-full justify-center rounded-xl px-5 py-3.5 text-[0.9375rem] font-semibold shadow-[var(--shadow-md)] ring-2 ring-[color-mix(in_srgb,var(--brand-teal)_22%,transparent)] transition-[transform,box-shadow] duration-200 hover:scale-[1.01] hover:shadow-[0_16px_44px_-12px_rgba(13,148,136,0.35)] active:scale-[0.99] sm:py-4"
            >
              Go live with Assistrio
            </TrackedCtaLink>
            <p className={`${hintClass} mt-auto pt-4 text-pretty`}>
              Hosted production — we run infrastructure and operations so your team stays focused on customers.
            </p>
          </div>
        </li>

        <li className="min-w-0">
          <div className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-white/95 p-5 shadow-[var(--shadow-xs)] ring-1 ring-slate-900/[0.04] sm:p-6">
            <p className={microClass}>Proof on your site</p>
            <TrackedFlowCtaButton
              flow="trial"
              href="/trial"
              location={`${LOCATION}_explore`}
              label="Try it free"
              variant="secondary"
              className="mt-4 w-full justify-center rounded-xl border border-[var(--border-teal-soft)] bg-white px-5 py-3.5 text-[0.9375rem] font-semibold shadow-[var(--shadow-xs)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0 sm:py-4"
            >
              Try it free
            </TrackedFlowCtaButton>
            <p className={`${hintClass} mt-auto pt-4 text-pretty`}>
              Free on your own allowed website — your workspace, no card, full feel for how Assistrio behaves for visitors.
            </p>
          </div>
        </li>

        <li className="min-w-0">
          <div className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-white/95 p-5 shadow-[var(--shadow-xs)] ring-1 ring-slate-900/[0.04] sm:p-6">
            <p className={microClass}>Quick preview</p>
            <TrackedFlowCtaButton
              flow="showcase"
              href="/gallery"
              location={`${LOCATION}_examples`}
              label="See live examples"
              variant="secondary"
              className="mt-4 w-full justify-center rounded-xl border border-[var(--border-default)] bg-slate-50/80 px-5 py-3.5 text-[0.9375rem] font-semibold text-slate-800 shadow-[var(--shadow-xs)] transition-[transform,box-shadow] duration-200 hover:border-slate-300 hover:bg-white hover:shadow-[var(--shadow-md)] active:translate-y-0 sm:py-4"
            >
              See live examples
            </TrackedFlowCtaButton>
            <p className={`${hintClass} mt-auto pt-4 text-pretty`}>
              Curated gallery demos — instant, no setup, great for sharing with stakeholders.
            </p>
          </div>
        </li>
      </ul>

      {/* Pricing route disabled — link to /pricing removed.
      <p className="mt-8 text-center text-[0.8125rem] leading-relaxed text-[var(--foreground-muted)] sm:mt-10">
        Need procurement, security review, or private deployment?{" "}
        <Link
          href="/pricing"
          className="font-semibold text-[var(--brand-teal-dark)] underline decoration-[var(--border-teal-soft)] underline-offset-[0.22em] transition-colors hover:text-[var(--brand-teal)] hover:decoration-[var(--brand-teal)]"
        >
          See pricing & Enterprise
        </Link>
      </p>
      */}
    </div>
  );
}
