import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionGlowBackdrop } from "@/components/sections/home/home-section-glow-backdrop";
import { FinalCtaRow } from "@/components/sections/home/final-cta-ctas";
import { ScrollReveal } from "@/components/motion/scroll-reveal";

export function FinalCta() {
  return (
    <Section
      id="cta"
      fillViewport
      spacing="loose"
      className="relative overflow-hidden border-t border-[var(--border-default)]"
    >
      <HomeSectionGlowBackdrop />

      <Container className="relative z-10">
        <ScrollReveal y={18}>
          <div className="mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-[1.85rem] border border-[var(--border-teal-soft)]/90 bg-white/90 px-5 py-12 shadow-[0_40px_100px_-36px_rgba(13,148,136,0.22),var(--shadow-premium)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_12%,transparent)] backdrop-blur-md sm:px-10 sm:py-14 lg:px-12 lg:py-16">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(13,148,136,0.1),transparent_70%)]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-[min(90%,28rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.06),transparent_72%)] blur-2xl"
                aria-hidden
              />

              <div className="relative text-center">
                <p className="text-eyebrow">Your next step</p>
                <h2
                  id="final-cta-heading"
                  className="text-home-h2 text-home-h2-premium mx-auto mt-5 max-w-[min(100%,22rem)] text-balance sm:mt-6 sm:max-w-3xl"
                >
                  Put always-on support in front of every customer
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-[var(--foreground-muted)] sm:mt-6 sm:text-[1.0625rem] sm:leading-[1.72]">
                  Same product — three ways to move forward. Pick the pace that fits how your team evaluates and buys.
                </p>

                <FinalCtaRow />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
