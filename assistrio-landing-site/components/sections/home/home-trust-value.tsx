import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const outcomes = [
  {
    title: "Be present when it matters",
    body: "Moments that used to evaporate after hours now get a thoughtful first response instead of silence.",
  },
  {
    title: "Sound like the company you are",
    body: "Trust is cumulative: when the thread matches your site and your voice, visitors stop treating the agent like a disposable widget.",
  },
  {
    title: "Make the human moment obvious",
    body: "Clarity beats cleverness — people should always know how to reach your team when software should step aside.",
  },
];

export function HomeTrustValue() {
  return (
    <Section id="trust-value" spacing="snug" className="relative border-b border-[var(--border-default)] bg-gradient-to-b from-white via-[var(--surface-muted)]/35 to-white">
      <Container size="narrow">
        <ScrollReveal y={20}>
          <HomeSectionHeader id="trust-value-heading" eyebrow="Outcomes" title="Never miss a visitor again" layout="editorial">
            <p>
              A closing emotional frame — we are not re-opening analytics, pricing, or hosting here. Those decisions already have a home on the page.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <div className="mt-12 space-y-10 sm:mt-14">
          {outcomes.map((o, i) => (
            <ScrollReveal key={o.title} y={18} delay={i * 0.05}>
              <blockquote className="border-l-2 border-[var(--brand-teal)]/35 py-1 pl-6 sm:pl-8">
                <h3 className="text-home-h3 text-pretty">{o.title}</h3>
                <p className="mt-3 text-[0.9375rem] leading-[1.72] text-[var(--foreground-muted)]">{o.body}</p>
              </blockquote>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
