import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { HomeLiveDemosCta } from "@/components/sections/home/home-live-demos-cta";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

export function HomeLiveDemos() {
  return (
    <Section id="live-demos" className="relative bg-white">
      <Container>
        <HomeSectionHeader id="live-demos-heading" eyebrow="Showcase" title="Try runtime before you commit">
          <p className="max-w-2xl text-base leading-relaxed">
            Open curated public bots and chat on this site with the same runtime API path as production — showcase quota is separate from your trial runtime.
          </p>
        </HomeSectionHeader>
        <Card className="mt-10 flex flex-col items-start gap-6 border-[var(--border-teal-soft)] bg-gradient-to-br from-[var(--brand-teal-subtle)]/30 via-white to-white p-8 shadow-[var(--shadow-sm)] ring-1 ring-[var(--brand-teal)]/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">Gallery</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--foreground-muted)]">
              Pick a bot, run the widget on this origin, and watch init, quota, and domain behavior — then attach your own trial bot to your hostname when you’re ready.
            </p>
          </div>
          <HomeLiveDemosCta />
        </Card>
      </Container>
    </Section>
  );
}
