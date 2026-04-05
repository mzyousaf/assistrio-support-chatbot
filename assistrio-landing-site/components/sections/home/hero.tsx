import { Section } from "@/components/layout/section";
import { HeroClient } from "@/components/sections/home/hero-client";

export function Hero() {
  return (
    <Section
      id="hero"
      fillViewport
      spacing="none"
      className="hero-section border-b border-[var(--border-default)] bg-[var(--background)] py-20 sm:py-28 lg:py-32"
    >
      <HeroClient />
    </Section>
  );
}
