import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const reasons = [
  {
    title: "No infrastructure to stand up",
    body: "Assistrio runs the runtime, APIs, and operational surfaces — your team focuses on content and policy, not load balancers.",
  },
  {
    title: "No DevOps calendar",
    body: "Skip patching queues, capacity planning, and incident rotations for chat infrastructure you did not want to own in the first place.",
  },
  {
    title: "Maintenance included",
    body: "Platform updates, reliability work, and guardrails evolve on our side so your AI Support Agent stays current.",
  },
  {
    title: "Support included",
    body: "When something blocks launch, you are not alone parsing logs — you have a vendor partner accountable for the hosted path.",
  },
  {
    title: "Faster launch",
    body: "From Explore embed to production traffic, Launch is the shortest line between “we need this” and “visitors are chatting.”",
  },
  {
    title: "Scale without replatforming",
    body: "Traffic growth maps to a service you already use — not a rewrite when the widget becomes business-critical.",
  },
  {
    title: "Explore to production is one story",
    body: "Evaluate on real allowed websites, then graduate the same AI Agent to Launch when you are ready — no throwaway demo stack.",
  },
];

export function HomeWhyHosted() {
  return (
    <Section
      id="why-hosted"
      spacing="loose"
      className="relative border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/30 via-white to-white"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)] to-transparent" aria-hidden />
      <Container>
        <ScrollReveal y={20}>
          <HomeSectionHeader id="why-hosted-heading" eyebrow="Commercial" title="Why businesses choose Launch" titleWide align="split">
            <p>
              <strong className="text-emphasis-primary">Launch</strong> is where we answer commercial questions: who runs uptime, patches, and incident response, how you
              move from Explore to production, and why you are not hiring a runtime team. Feature depth stays in the sections above; this block is the business case for our
              operations layer. Enterprise remains when policy demands private deployment.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:gap-6">
          {reasons.map((r, i) => (
            <ScrollReveal key={r.title} y={20} delay={i * 0.035}>
              <div className="h-full rounded-[var(--radius-xl)] border border-[var(--border-teal-soft)] bg-white/90 p-7 shadow-[var(--shadow-sm)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_10%,transparent)] sm:p-8">
                <h3 className="text-home-h3 text-pretty">{r.title}</h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--foreground-muted)]">{r.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
