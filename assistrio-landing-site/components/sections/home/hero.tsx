import { Section } from "@/components/layout/section";
import { HeroClient } from "@/components/sections/home/hero-client";

export function Hero() {
  return (
    <Section
      id="hero"
      fillViewport
      spacing="none"
      className="hero-section relative overflow-hidden border-b border-[var(--border-default)] bg-gradient-to-b from-[#f8fafb] via-white to-[var(--background)] py-20 sm:py-28 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="hero-gradient-blob absolute -left-1/4 top-0 h-[min(58vh,34rem)] w-[72%] max-w-4xl rounded-full opacity-[0.55] blur-3xl" />
        <div className="hero-gradient-blob-alt absolute -right-1/3 bottom-0 h-[min(48vh,26rem)] w-[58%] max-w-3xl rounded-full opacity-[0.45] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)]/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)]/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[min(42%,13rem)] bg-gradient-to-t from-white/95 via-transparent to-transparent blur-2xl" />
      </div>
      <HeroClient />
    </Section>
  );
}
