"use client";

import { motion } from "framer-motion";
import { ButtonLink, buttonBaseClass, buttonVariantClass } from "@/components/ui/button";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { useCtaFlow } from "@/components/flows/cta-flow-context";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useTrackEvent } from "@/hooks/useTrackEvent";

function planHeadingId(planName: string) {
  return `plan-${planName.toLowerCase().replace(/\s+/g, "-")}`;
}

export type PlanContentGroup = {
  title: string;
  items: string[];
};

export type PlanItem = {
  name: string;
  /** Primary price line, e.g. "$0" or "$500" */
  priceDisplay: string;
  /** Secondary line under price, e.g. billing cadence */
  priceSubline?: string;
  groups: PlanContentGroup[];
  cta: string;
  href: string;
  variant: "primary" | "secondary";
  featured?: boolean;
  badge?: string;
  /** Intent label above the plan button, e.g. "For production" */
  ctaPathLabel?: string;
  /** One line under the CTA clarifying the path */
  ctaSupportingText?: string;
};

function PlanGroupList({ title, items, isLast }: PlanContentGroup & { isLast: boolean }) {
  return (
    <div className={`w-full min-w-0 ${isLast ? "" : "border-b border-[var(--border-default)]/90 pb-4"}`}>
      <h4 className="text-home-h4 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">
        {title}
      </h4>
      <ul className="mt-2 w-full space-y-2 text-[0.8125rem] leading-[1.65] text-[var(--foreground-muted)]">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`} className="flex w-full min-w-0 gap-2.5">
            <span
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--brand-teal)]"
              aria-hidden
            />
            <span className="min-w-0 flex-1">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type GridProps = {
  plans: PlanItem[];
  /** Slightly roomier cards for the full /pricing page */
  density?: "default" | "comfortable";
  className?: string;
  /** Analytics `location` for Explore (/trial modal) CTA clicks */
  trackLocation?: string;
};

export function PlansPricingGrid({ plans, density = "default", className = "", trackLocation = "home_pricing" }: GridProps) {
  const { openTrial } = useCtaFlow();
  const { track } = useTrackEvent();
  const reduceMotion = usePrefersReducedMotion();
  const pad = density === "comfortable" ? "p-8 sm:p-9" : "p-6 sm:p-8";
  const featuredPad = density === "comfortable" ? "p-8 pb-9 pt-10 sm:p-9 sm:pb-10 sm:pt-11" : "p-6 pb-7 pt-8 sm:p-8 sm:pb-9 sm:pt-10";

  return (
    <div
      className={`mt-8 grid gap-6 sm:mt-10 sm:gap-7 lg:grid-cols-3 lg:items-stretch lg:gap-8 ${className}`.trim()}
      role="list"
      aria-label="Pricing plans"
    >
      {plans.map((p, i) => (
        <div
          key={p.name}
          role="listitem"
          className={`flex h-full min-h-0 flex-col ${p.featured ? "order-first lg:order-none" : ""}`}
        >
          <ScrollReveal delay={i * 0.06} y={18} className="flex h-full min-h-0 flex-1 flex-col">
            <motion.article
              whileHover={reduceMotion ? undefined : p.featured ? { y: -3 } : { y: -2 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              aria-labelledby={planHeadingId(p.name)}
              className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border bg-white transition-[box-shadow,border-color] duration-300 ${
                p.featured
                  ? `border-[var(--border-teal-soft)] ${featuredPad} shadow-[0_20px_50px_-24px_rgba(13,148,136,0.28),var(--shadow-md)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_18%,transparent)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-[var(--brand-teal)] before:to-teal-400`
                  : `${pad} border-[var(--border-default)] shadow-[var(--shadow-xs)] ring-1 ring-slate-900/[0.02] hover:border-[var(--border-teal-soft)]/60 hover:shadow-[var(--shadow-md)]`
              }`}
            >
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <h3
                    id={planHeadingId(p.name)}
                    className={`text-plan-name ${p.featured ? "text-[clamp(1.35rem,2.1vw,1.6rem)]" : ""}`}
                  >
                    {p.name}
                  </h3>
                </div>
                {p.badge ? (
                  <span className="inline-flex max-w-full shrink-0 items-center rounded-full border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/85 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand-teal-dark)] sm:max-w-[11rem]">
                    {p.badge}
                  </span>
                ) : null}
              </div>

              <div
                className={`mt-4 flex min-h-[5.5rem] shrink-0 flex-col justify-center rounded-xl border px-4 py-3.5 sm:min-h-[5.75rem] ${
                  p.featured
                    ? "border-[var(--border-teal-soft)] bg-[color-mix(in_srgb,var(--brand-teal-subtle)_30%,white)]"
                    : "border-[var(--border-default)] bg-slate-50/80"
                }`}
              >
                <p className={`text-balance ${p.featured ? "text-plan-price-featured" : "text-plan-price"}`}>
                  <span className="sr-only">Price: </span>
                  {p.priceDisplay}
                </p>
                {p.priceSubline ? (
                  <p className="text-plan-price-note mt-1">{p.priceSubline}</p>
                ) : (
                  <div className="mt-1 min-h-[1.15rem]" aria-hidden />
                )}
              </div>

              <div
                className={`mt-5 flex min-h-0 flex-1 flex-col sm:mt-6 ${
                  p.featured
                    ? "rounded-xl bg-slate-50/70 p-4 ring-1 ring-slate-900/[0.04] sm:p-5"
                    : ""
                }`}
              >
                <p className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                  What&apos;s included
                </p>
                <div className="mt-3 min-h-0 flex-1 space-y-4" role="group" aria-label={`${p.name} plan features`}>
                  {p.groups.map((g, gi) => (
                    <PlanGroupList key={g.title} {...g} isLast={gi === p.groups.length - 1} />
                  ))}
                </div>
              </div>

              <div className="mt-auto shrink-0 border-t border-[var(--border-default)]/80 pt-6">
                {p.ctaPathLabel ? (
                  <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                    {p.ctaPathLabel}
                  </p>
                ) : null}
                <div className={p.ctaPathLabel ? "mt-2 space-y-2" : "space-y-2"}>
                  {p.href === "/trial" ? (
                    <button
                      type="button"
                      onClick={() => {
                        track("cta_clicked", { location: trackLocation, label: p.cta, href: p.href });
                        openTrial();
                      }}
                      className={`${buttonBaseClass} ${buttonVariantClass[p.variant]} w-full justify-center rounded-xl px-5 py-3.5 text-[0.9375rem] font-semibold ${
                        p.featured
                          ? "btn-primary-shimmer py-3.5 text-base shadow-[var(--shadow-sm)] ring-2 ring-[color-mix(in_srgb,var(--brand-teal)_22%,transparent)]"
                          : ""
                      }`}
                    >
                      {p.cta}
                    </button>
                  ) : (
                    <ButtonLink
                      href={p.href}
                      variant={p.variant}
                      className={`w-full justify-center rounded-xl px-5 py-3.5 text-[0.9375rem] font-semibold ${
                        p.featured
                          ? "btn-primary-shimmer py-3.5 text-base shadow-[var(--shadow-sm)] ring-2 ring-[color-mix(in_srgb,var(--brand-teal)_22%,transparent)]"
                          : ""
                      }`}
                    >
                      {p.cta}
                    </ButtonLink>
                  )}
                  {p.ctaSupportingText ? (
                    <p className="text-center text-[0.8125rem] leading-snug text-[var(--foreground-muted)]">
                      {p.ctaSupportingText}
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.article>
          </ScrollReveal>
        </div>
      ))}
    </div>
  );
}

/** Full pricing route disabled — see commented block in `plans-overview.tsx` when re-enabling. */
export function PlansPricingFooter() {
  return null;
}
