import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const problems = [
  "The same product and billing questions land in the inbox every week.",
  "Docs exist, but visitors skim and still ask humans for a short answer.",
  "Support teams want consistency — not ten slightly different explanations of the same policy.",
  "You need visibility into what people ask before it becomes a ticket or churn risk.",
];

export function HomeWhatIsAiSupportAgent() {
  return (
    <Section
      id="what-is-ai-support-agent"
      spacing="default"
      tone="muted"
      className="border-b border-[var(--border-default)]"
    >
      <Container>
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
          <div className="lg:col-span-6">
            <ScrollReveal y={20}>
              <HomeSectionHeader id="what-is-ai-support-agent-heading" eyebrow="Definition" title="What is an AI Support Agent?" titleWide>
                <p>
                  An <strong className="text-emphasis-primary">AI Support Agent</strong> is a chat assistant you embed on your website. It answers visitors in
                  natural language using the knowledge you connect — help articles, FAQs, policies, and docs — so people get accurate,
                  on-brand help without leaving the page.
                </p>
                <p>
                  It is not a replacement for every human conversation. It handles repeatable, knowledge-backed questions, captures leads
                  when you want handoffs, and surfaces analytics so you can see themes before they overwhelm your queue.
                </p>
              </HomeSectionHeader>
            </ScrollReveal>
          </div>
          <div className="mt-12 lg:col-span-6 lg:mt-0">
            <ScrollReveal y={22} delay={0.06}>
              <aside className="h-full rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white p-7 shadow-[var(--shadow-sm)] sm:p-9 lg:min-h-[min(100%,22rem)]">
                <p className="text-card-label-accent">Problems it helps solve</p>
                <ul className="mt-6 space-y-4 text-[0.9375rem] leading-[1.72] text-[var(--foreground-muted)]">
                  {problems.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </ScrollReveal>
          </div>
        </div>
      </Container>
    </Section>
  );
}
