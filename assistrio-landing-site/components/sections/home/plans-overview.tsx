import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { PlansPricingGrid } from "@/components/sections/home/plans-pricing-grid";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HOMEPAGE_PRICING_PLANS } from "@/lib/pricing-content";

export function PlansOverview() {
  return (
    <Section
      id="pricing"
      spacing="snug"
      className="relative border-b border-[var(--border-default)] bg-[var(--background)]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(ellipse_72%_100%_at_50%_0%,rgba(13,148,136,0.055),transparent_72%)]"
        aria-hidden
      />
      <Container className="relative">
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
