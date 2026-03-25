import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLinkGroup } from "@/components/shared/button-link";
import { FeatureCard } from "@/components/shared/feature-card";
import { SectionHeader } from "@/components/shared/section-header";
import type { HomeValuePropsContent } from "@/types/home";

type HomeValuePropsProps = {
  content: HomeValuePropsContent;
};

export function HomeValueProps({ content }: HomeValuePropsProps) {
  return (
    <Section>
      <Container>
        <SectionHeader
          title={content.headline}
          subtitle={content.subheadline}
          description={content.body}
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.items.map((item) => (
            <FeatureCard key={item.title} item={item} />
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
