import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { FinalCtaRow } from "@/components/sections/home/final-cta-ctas";

export function FinalCta() {
  return (
    <Section id="cta" className="border-t border-[var(--border-default)] bg-gradient-to-br from-[var(--brand-teal-subtle)]/40 via-white to-[var(--background)] pb-20 pt-16 sm:pb-24 sm:pt-20">
      <Container size="narrow" className="text-center">
        <div className="mx-auto max-w-xl rounded-[1.35rem] border border-[var(--border-teal-soft)] bg-white/90 px-6 py-10 shadow-[var(--shadow-md)] ring-1 ring-[var(--brand-teal)]/10 backdrop-blur-sm sm:px-10 sm:py-12">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Ready to try Assistrio?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[var(--foreground-muted)]">
            Start a free trial with your stable id, or open the gallery to see runtime behavior on this site first.
          </p>
          <FinalCtaRow />
        </div>
      </Container>
    </Section>
  );
}
