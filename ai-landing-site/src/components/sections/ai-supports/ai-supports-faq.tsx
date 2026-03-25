import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLink } from "@/components/shared/button-link";
import { FaqAccordion } from "@/components/shared/faq-accordion";
import { SectionHeader } from "@/components/shared/section-header";
import type { AiSupportsFaqContent } from "@/types/ai-supports";

type AiSupportsFaqProps = {
  content: AiSupportsFaqContent;
};

export function AiSupportsFaq({ content }: AiSupportsFaqProps) {
  return (
    <Section id="faq" variant="subtle">
      <Container>
        <SectionHeader
          title={content.headline}
          subtitle={content.subheadline}
          align="center"
          className="mx-auto max-w-2xl"
        />
        <FaqAccordion items={content.items} className="mx-auto mt-12 max-w-3xl" />
        {content.footerCta ? (
          <p className="mt-8 text-center">
            <ButtonLink
              href={content.footerCta.href}
              label={content.footerCta.label}
              variant="link"
            />
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
