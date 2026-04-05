import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const items = [
  {
    title: "Invite teammates with clear roles",
    body: "Bring product, support, and revenue into one workspace so knowledge and tone stay consistent as you scale.",
  },
  {
    title: "Update knowledge together",
    body: "Ship doc changes, FAQs, and policy notes without waiting on a single owner — everyone sees what the AI Support Agent will cite next.",
  },
  {
    title: "Monitor handoffs as a team",
    body: "Shared visibility into warm conversations so ownership is obvious — without re-explaining pipeline mechanics from the Lead capture section.",
  },
  {
    title: "Review demand signals together",
    body: "The same charts and summaries you saw in Analytics become a standing agenda item — here we care about who is in the room when you read them.",
  },
  {
    title: "Improve responses collaboratively",
    body: "When transcripts show gaps, prompts and documents change in lockstep instead of living in one person’s notes.",
  },
  {
    title: "Run it like an operation",
    body: "Roles, access, and review habits — how organizations adopt software, not which feature ships first.",
  },
];

export function HomeTeammates() {
  return (
    <Section id="teammates" spacing="snug" className="border-b border-[var(--border-default)] bg-[var(--background)]">
      <Container size="narrow">
        <ScrollReveal y={20}>
          <HomeSectionHeader id="teammates-heading" eyebrow="Collaboration" title="Bring your teammates in" layout="editorial">
            <p>
              Collaboration is about <strong className="font-semibold text-slate-800">who touches the system</strong> — not another recap of analytics, hosting, or lead fields.
              Those topics already have owners elsewhere on the page.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <ScrollReveal y={18} delay={0.06} className="mt-12 border-t border-[var(--border-default)] pt-2">
          <ul className="divide-y divide-[var(--border-default)]">
            {items.map((item) => (
              <li key={item.title} className="py-8 first:pt-6">
                <h3 className="text-home-h3 text-pretty">{item.title}</h3>
                <p className="mt-3 max-w-2xl text-[0.9375rem] leading-[1.72] text-[var(--foreground-muted)]">{item.body}</p>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
