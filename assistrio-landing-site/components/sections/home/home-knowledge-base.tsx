import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const sources = [
  { label: "Documents", desc: "PDFs, guides, and long-form references your team already trusts." },
  { label: "FAQs", desc: "Short, high-intent answers visitors repeat every week." },
  { label: "Notes", desc: "Internal clarity written once, reused everywhere in chat." },
  { label: "URLs", desc: "Pages and articles you want the AI Support Agent to stay aligned with." },
  { label: "Plain descriptions", desc: "Hand-authored explanations when tone and precision matter." },
  { label: "Contacts & roles", desc: "Who does what — so handoffs and responsibilities stay accurate." },
];

export function HomeKnowledgeBase() {
  return (
    <Section id="knowledge-base" spacing="snug" className="border-b border-[var(--border-default)] bg-white">
      <Container>
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-14 xl:gap-x-20">
          <div className="lg:col-span-5">
            <ScrollReveal y={20}>
              <HomeSectionHeader id="knowledge-base-heading" eyebrow="Knowledge" title="Ground every answer in what you already know">
                <p>
                  This is the only place we go deep on <strong className="text-emphasis-primary">sources</strong>: what you connect, how it stays accurate, and why visitors
                  stop getting contradictory answers from scattered docs.
                </p>
              </HomeSectionHeader>
            </ScrollReveal>
            <ScrollReveal y={18} delay={0.08} className="mt-10 hidden lg:block">
              <div className="rounded-[var(--radius-xl)] border border-[var(--border-teal-soft)] bg-gradient-to-br from-[var(--brand-teal-subtle)]/40 via-white to-slate-50/80 p-8 shadow-[var(--shadow-md)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_10%,transparent)]">
                <p className="text-card-label-accent">Outcomes</p>
                <ul className="mt-5 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--foreground-muted)]">
                  {[
                    "Grounded answers visitors can trust",
                    "Higher support accuracy with less manual copy-paste",
                    "Faster help without growing headcount linearly",
                    "Fewer repetitive questions exhausting your team",
                  ].map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
          <ScrollReveal y={22} delay={0.06} className="mt-12 lg:col-span-7 lg:mt-0">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {sources.map((item, i) => (
                <div
                  key={item.label}
                  className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-muted)]/40 p-5 transition-colors hover:border-[color-mix(in_srgb,var(--brand-teal)_25%,var(--border-default))] hover:bg-white sm:p-6"
                  style={{ transitionDelay: `${i * 20}ms` }}
                >
                  <h3 className="text-home-h3 text-base">{item.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-muted)]/30 p-6 lg:hidden">
              <p className="text-card-label">Outcomes</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
                Grounded answers, better accuracy, faster visitor help, and less repetitive load on your team — because your AI Support Agent pulls from sources you control.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </Container>
    </Section>
  );
}
