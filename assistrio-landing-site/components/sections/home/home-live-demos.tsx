import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { Card } from "@/components/ui/card";
import { HomeLiveDemosCta } from "@/components/sections/home/home-live-demos-cta";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

export function HomeLiveDemos() {
  return (
    <Section id="live-demos" className="relative bg-white">
      <Container>
        <ScrollReveal y={20}>
          <HomeSectionHeader id="live-demos-heading" eyebrow="Showcase" title="Try a live demo">
            <p className="max-w-2xl text-base leading-relaxed">
              Open curated public AI Agents and chat on this site with the same runtime path as production.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>
        <Card className="mt-10 flex flex-col items-start gap-6 border-[var(--border-teal-soft)] bg-gradient-to-br from-[var(--brand-teal-subtle)]/30 via-white to-white p-8 shadow-[var(--shadow-md)] ring-1 ring-[var(--brand-teal)]/12 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-premium)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">Showcase agents</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--foreground-muted)]">
              Pick an agent in the panel — the API enforces allowed websites and keys the same way as production.
            </p>
          </div>
          <HomeLiveDemosCta />
        </Card>
      </Container>
    </Section>
  );
}
