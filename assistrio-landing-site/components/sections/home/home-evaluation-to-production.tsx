"use client";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { ScrollReveal } from "@/components/motion/scroll-reveal";

const steps = [
  {
    title: "Try it free",
    bullets: [
      "Experience Assistrio for free on your allowed website",
      "No credit card required — a real evaluation, not a toy",
      "Same runtime your visitors will see in production",
    ],
  },
  {
    title: "Customize it",
    bullets: [
      "Branding and widget that feel native to your product",
      "Knowledge, tone, and guardrails you control",
      "Leads and analytics for revenue and support teams",
    ],
  },
  {
    title: "Align on your launch",
    bullets: [
      "We learn your site, customers, and how support should sound",
      "Tone, escalation, and what “done” looks like when the AI Agent is live",
      "So Launch matches how your business actually operates",
    ],
  },
  {
    title: "We configure your workspace",
    bullets: [
      "Branding, widget, allowed websites, and knowledge in one place",
      "Answers match your policies; the experience feels native",
      "We carry implementation detail — you keep the story",
    ],
  },
  {
    title: "Go live with confidence",
    bullets: [
      "Ship on the hostnames you control with our team beside you",
      "Assistrio runs production runtime, scale, and uptime — you own content and insights",
      "Hosted Launch by default; Enterprise when private deployment is required",
    ],
  },
] as const;

type EvaluationProps = {
  /** Renders a div shell instead of a full viewport section (used inside HomePrimarySectionsTabs). */
  embeddedInCarousel?: boolean;
};

/**
 * Homepage band: evaluation → customization → launch alignment → configuration → go-live.
 */
export function HomeEvaluationToProduction({ embeddedInCarousel = false }: EvaluationProps = {}) {
  const inner = (
    <>
      {!embeddedInCarousel ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 -top-16 h-36 bg-[radial-gradient(ellipse_90%_100%_at_50%_0%,rgba(204,251,241,0.4),transparent_70%)] blur-2xl"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)] to-transparent" aria-hidden />
        </>
      ) : null}

      <Container className="relative">
        <ScrollReveal y={14}>
          <p className="text-center text-eyebrow">How teams go live</p>
          <h2
            id="evaluation-to-production-heading"
            className="text-home-h2 mx-auto mt-6 max-w-[min(100%,46rem)] text-balance text-center sm:mt-7"
          >
            From first embed to production support
          </h2>
          <p className="text-body-relaxed mx-auto mt-5 max-w-2xl text-pretty text-center">
            Prove Assistrio on your allowed website, make it unmistakably yours, then work with us to align on launch, finish configuration, and ship a channel customers can rely on
            — without your team owning infrastructure night and day.
          </p>

          <div className="relative mx-auto mt-14 max-w-6xl sm:mt-16">
            <div
              className="pointer-events-none absolute left-[8%] right-[8%] top-[1.125rem] hidden h-[2px] bg-gradient-to-r from-[var(--brand-teal)]/12 via-[var(--brand-teal)]/30 to-[var(--brand-teal)]/12 xl:block"
              aria-hidden
            />
            <ol className="grid list-none grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-6 xl:grid-cols-5 xl:gap-4">
              {steps.map((step, i) => (
                <li key={step.title} className="relative">
                  <div className="relative h-full rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white/95 px-5 pb-6 pt-10 shadow-[var(--shadow-sm)] ring-1 ring-slate-900/[0.03] sm:px-5 sm:pb-7">
                    <div
                      className="absolute left-1/2 top-0 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--brand-teal)] bg-white text-sm font-bold tabular-nums text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)]"
                      aria-hidden
                    >
                      {i + 1}
                    </div>
                    <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand-teal-dark)]">
                      Step {i + 1}
                    </p>
                    <h3 className="mt-2 text-center font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                      {step.title}
                    </h3>
                    <ul className="mt-4 space-y-2.5 text-[0.8125rem] leading-snug text-[var(--foreground-muted)]">
                      {step.bullets.map((b) => (
                        <li key={b} className="flex gap-2.5">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--brand-teal)]/75" aria-hidden />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </ScrollReveal>

        <ScrollReveal y={16} delay={0.08} className="mt-12 text-center sm:mt-14">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">Ready to go live</p>
          <p className="text-meta mx-auto mt-2 max-w-md text-[var(--foreground-muted)]">
            Talk with us about timing, allowed websites, and what always-on should mean for your customers.
          </p>
          <TrackedCtaLink
            href="/contact"
            location="home_evaluation_to_production"
            label="Go live with Assistrio"
            variant="primary"
            className="btn-primary-shimmer mt-4 inline-flex justify-center rounded-[var(--radius-lg)] px-8 py-3.5 text-[0.9375rem] font-semibold shadow-[var(--shadow-sm)] ring-2 ring-[color-mix(in_srgb,var(--brand-teal)_18%,transparent)]"
          >
            Go live with Assistrio
          </TrackedCtaLink>
          <p className="text-meta mx-auto mt-2 max-w-sm text-[var(--foreground-muted)]">Full hosted Launch — we run production so you run the business</p>
        </ScrollReveal>
      </Container>
    </>
  );

  if (embeddedInCarousel) {
    return (
      <div id="evaluation-to-production" className="relative bg-transparent py-0">
        {inner}
      </div>
    );
  }

  return (
    <Section
      id="evaluation-to-production"
      fillViewport
      spacing="loose"
      className="relative border-b border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-muted)_48%,white)]"
    >
      {inner}
    </Section>
  );
}
