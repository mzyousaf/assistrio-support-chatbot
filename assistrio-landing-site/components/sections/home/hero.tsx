import { Section } from "@/components/layout/section";
import { HeroClient } from "@/components/sections/home/hero-client";

export function Hero() {
  return (
    <Section
      id="hero"
      fillViewport
      spacing="none"
      className="hero-section border-b border-[var(--border-default)] bg-[var(--background)] pt-14 pb-20 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-32"
    >
      <HeroClient />
    </Section>
  );
}
