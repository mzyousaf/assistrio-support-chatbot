import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const points = [
  {
    title: "Capture the right details",
    body: "Collect name, email, role, and the fields your funnel needs — when the visitor is already engaged, not after they have bounced.",
  },
  {
    title: "Understand intent before the inbox",
    body: "See what they were trying to accomplish in chat so your first human reply is relevant, not generic.",
  },
  {
    title: "Follow up faster",
    body: "Structured handoffs mean sales and success spend less time reconstructing the story from a messy transcript.",
  },
  {
    title: "Keep lead context attached",
    body: "Conversation context travels with the lead so nobody asks the same questions twice.",
  },
  {
    title: "Improve conversion over time",
    body: "Spot where visitors abandon handoffs and tighten flows — your AI Support Agent and forms work as one system.",
  },
];

export function HomeLeadCapture() {
  return (
    <Section id="lead-capture" spacing="loose" tone="muted" className="border-b border-[var(--border-default)]">
      <Container>
        <ScrollReveal y={20}>
          <HomeSectionHeader id="lead-capture-heading" eyebrow="Pipeline" title="Turn conversations into qualified leads" titleWide align="split">
            <p>
              Demand and handoffs live here only: forms, fields, intent, and follow-up — not charts, not widget chrome, not hosting economics.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {points.map((p, i) => (
            <ScrollReveal key={p.title} y={20} delay={i * 0.04}>
              <div className="h-full rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white p-6 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-md)] sm:p-7">
                <p className="text-card-label">Sales outcome</p>
                <h3 className="text-home-h3 mt-3 text-pretty">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{p.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
