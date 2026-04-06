import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const categories: { title: string; body: string }[] = [
  {
    title: "SaaS",
    body: "Deflect repetitive how-to and pricing questions with an AI Support Agent wired to your product docs and help center.",
  },
  {
    title: "Ecommerce",
    body: "Handle shipping, returns, sizing, and product FAQs at scale so buyers get instant answers during the purchase journey.",
  },
  {
    title: "Agencies",
    body: "Give each client a polished support surface on their site — grounded answers without rebuilding internal playbooks from scratch.",
  },
  {
    title: "Law firms",
    body: "Guide visitors through intake-friendly explanations of services and policies, with clear paths to human review where required.",
  },
  {
    title: "Healthcare",
    body: "Answer general education and navigation questions from approved materials while keeping clinical and emergency workflows on human channels.",
  },
  {
    title: "Education",
    body: "Support students and families with consistent answers about programs, deadlines, and resources drawn from your official content.",
  },
  {
    title: "Service businesses",
    body: "Capture what prospects ask, explain offerings and SLAs uniformly, and shorten the path from question to booked conversation.",
  },
  {
    title: "Enterprise teams",
    body: "Roll out AI Support Agents with the governance patterns IT and support orgs expect — approvals, allowed websites, and shared ownership of what ships.",
  },
];

export function HomeWhoItsFor() {
  return (
    <Section id="who-its-for" spacing="snug" className="border-b border-[var(--border-default)] bg-white">
      <Container>
        <ScrollReveal y={20}>
          <HomeSectionHeader id="who-its-for-heading" eyebrow="Audience" title="Built for every industry that talks to visitors" titleWide align="split">
            <p>
              Verticals below are <strong className="text-emphasis-primary">examples of fit</strong>, not separate products — the same AI Support Agent stack applies; only
              the knowledge and tone change.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <ScrollReveal y={22} delay={0.05} className="mt-14 lg:mt-16">
          <ul className="grid gap-px overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-2 xl:grid-cols-4">
            {categories.map((c) => (
              <li key={c.title} className="bg-white p-6 transition-colors duration-200 hover:bg-[var(--surface-muted)]/40 sm:p-7">
                <h3 className="text-home-h3">{c.title}</h3>
                <p className="mt-3 text-[0.9375rem] leading-[1.72] text-[var(--foreground-muted)]">{c.body}</p>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
