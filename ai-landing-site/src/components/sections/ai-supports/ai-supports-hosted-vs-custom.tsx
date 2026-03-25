import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLinkGroup } from "@/components/shared/button-link";
import { DeliveryCard } from "@/components/shared/delivery-card";
import { SectionHeader } from "@/components/shared/section-header";
import type { AiSupportsHostedVsCustomContent } from "@/types/ai-supports";

type AiSupportsHostedVsCustomProps = {
  content: AiSupportsHostedVsCustomContent;
};

export function AiSupportsHostedVsCustom({
  content,
}: AiSupportsHostedVsCustomProps) {
  return (
    <Section id="hosted-vs-custom">
      <Container>
        <SectionHeader
          title={content.headline}
          subtitle={content.subheadline}
          description={content.intro}
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {content.columns.map((column) => (
            <DeliveryCard key={column.title} column={column} />
          ))}
        </div>
        {content.ctas.length > 0 ? (
          <ButtonLinkGroup
            items={content.ctas.map((c) => ({
              label: c.label,
              href: c.href,
              variant: c.variant,
            }))}
            className="mt-10"
          />
        ) : null}
      </Container>
    </Section>
  );
}
