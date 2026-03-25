import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLinkGroup } from "@/components/shared/button-link";
import { SectionHeader } from "@/components/shared/section-header";
import { StepList } from "@/components/shared/step-list";
import type { HomeHowItWorksContent } from "@/types/home";

type HomeHowItWorksProps = {
  content: HomeHowItWorksContent;
};

export function HomeHowItWorks({ content }: HomeHowItWorksProps) {
  return (
    <Section id="how-it-works" variant="subtle">
      <Container>
        <SectionHeader
          title={content.headline}
          subtitle={content.subheadline}
        />
        <StepList steps={content.steps} className="mt-12" />
        {content.ctas.length > 0 ? (
          <ButtonLinkGroup
            items={content.ctas.map((c) => ({
              label: c.label,
              href: c.href,
              variant: c.variant,
            }))}
            className="mt-12"
          />
        ) : null}
      </Container>
    </Section>
  );
}
