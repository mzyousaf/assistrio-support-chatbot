import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionGlowBackdrop } from "@/components/sections/home/home-section-glow-backdrop";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { PlansPricingGrid } from "@/components/sections/home/plans-pricing-grid";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HOMEPAGE_PRICING_PLANS } from "@/lib/pricing-content";

export function PlansOverview() {
  return (
    <Section
      id="pricing"
      spacing="snug"
      className="relative overflow-hidden border-b border-[var(--border-default)]"
    >
      <HomeSectionGlowBackdrop />
      <Container className="relative z-10">
        <ScrollReveal y={18}>
          <HomeSectionHeader
            id="pricing-heading"
            eyebrow="Pricing"
            title="Try it free. Launch when you are ready."
            titleWide
            titleVariant="premium"
            lead="One product — try it free, run hosted production, or own deployment privately."
          />
        </ScrollReveal>
        {/*
          Full pricing page disabled — when /pricing is restored, place the details CTA here (under the heading, above the cards):
          <div className="mt-6 flex justify-center sm:mt-7">
            <ButtonLink href="/pricing" variant="primary" className="min-w-[12rem] px-6">
              View pricing details
            </ButtonLink>
          </div>
        */}
        <PlansPricingGrid plans={HOMEPAGE_PRICING_PLANS} />
      </Container>
    </Section>
  );
}
