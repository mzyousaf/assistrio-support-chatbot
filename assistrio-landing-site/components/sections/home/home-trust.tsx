import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const readiness = [
  {
    title: "Surfaces stay separated",
    body: "Preview for owners, runtime for customers — so tests in Assistrio never become your public embed by accident.",
  },
  {
    title: "Authorization in the API",
    body: "Allowlists, keys, and visitor identity are enforced server-side. CORS lets browsers read responses; it is not the ownership gate.",
  },
  {
    title: "Operable in production",
    body: "No fake metrics here — rate limits, quotas, and deployment hints are meant to be debuggable when something misconfigures.",
  },
];

/**
 * Trust & readiness — no fake logos or customer claims.
 */
export function HomeTrust() {
  return (
    <Section id="trust" tone="muted" className="relative border-b border-[var(--border-default)]">
      <Container>
        <HomeSectionHeader id="trust-heading" eyebrow="Trust" title="Ready for serious rollouts">
          <p className="max-w-2xl text-base leading-relaxed">
            We prioritize clarity: you should understand how preview, runtime, and identity interact before customers hit your widget.
          </p>
        </HomeSectionHeader>
        <div className="mt-12 rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/80 p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {readiness.map((p, i) => (
              <Card key={p.title} className="relative border-[var(--border-default)] bg-white/90 p-5 pt-8 shadow-none sm:p-6 sm:pt-9">
                <span className="absolute left-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-teal-subtle)] text-xs font-bold text-[var(--brand-teal-dark)] sm:left-6 sm:top-6">
                  {i + 1}
                </span>
                <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{p.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
