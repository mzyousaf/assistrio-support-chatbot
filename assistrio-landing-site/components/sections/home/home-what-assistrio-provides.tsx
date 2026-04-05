import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const pillars: { kicker: string; title: string; outcome: string }[] = [
  {
    kicker: "01",
    title: "Knowledge Base",
    outcome: "The memory layer — what the AI Support Agent is allowed to know and cite. Depth and formats are covered next in Knowledge Base.",
  },
  {
    kicker: "02",
    title: "Branding & Chat Experience",
    outcome: "The presentation layer — how the thread looks, reads, and behaves in your product chrome. Controls and visitor experience are unpacked in Branding & chat.",
  },
  {
    kicker: "03",
    title: "Lead Capture",
    outcome: "The handoff layer — turning high-intent chats into records your team can act on. Pipeline mechanics are isolated in Lead capture.",
  },
  {
    kicker: "04",
    title: "Analytics & Insights",
    outcome: "The signal layer — volume, themes, and intent in charts you can review with stakeholders. Detail lives in Analytics & insights.",
  },
];

export function HomeWhatAssistrioProvides() {
  return (
    <Section id="what-assistrio-provides" spacing="default" tone="muted" className="relative border-y border-[var(--border-default)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)]/80 to-transparent" aria-hidden />
      <Container>
        <ScrollReveal y={20}>
          <HomeSectionHeader id="what-assistrio-provides-heading" eyebrow="Platform" title="Everything your AI Support Agent needs to perform" titleWide align="split">
            <p>
              Four cooperating systems — not four buzzwords. Each block below maps to a dedicated section so we are not repeating the same story four times on the scroll.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <div className="mt-12 grid gap-5 sm:mt-14 sm:gap-6 lg:grid-cols-2">
          {pillars.map((p, i) => (
            <ScrollReveal key={p.title} y={22} delay={i * 0.05}>
              <article
                className={`group h-full border-l-2 border-[var(--border-default)] bg-transparent py-2 pl-6 transition-colors duration-300 hover:border-[var(--brand-teal)]/45 sm:pl-8 ${
                  i === 0 ? "border-l-[var(--brand-teal)]/55" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-[-0.04em] text-[color-mix(in_srgb,var(--brand-teal-dark)_35%,var(--foreground-subtle)_65%)] transition-colors group-hover:text-[var(--brand-teal-dark)]"
                    aria-hidden
                  >
                    {p.kicker}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-home-h3 text-pretty">{p.title}</h3>
                    <p className="mt-3 text-[0.9375rem] leading-[1.72] text-[var(--foreground-muted)]">{p.outcome}</p>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
