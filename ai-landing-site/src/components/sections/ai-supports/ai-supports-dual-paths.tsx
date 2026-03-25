import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HubPathCard } from "@/components/shared/hub-path-card";
import { SectionHeader } from "@/components/shared/section-header";
import type { AiSupportsDualPathsContent } from "@/types/ai-supports";

type AiSupportsDualPathsProps = {
  content: AiSupportsDualPathsContent;
};

export function AiSupportsDualPaths({ content }: AiSupportsDualPathsProps) {
  return (
    <Section variant="subtle" id="paths">
      <Container>
        <SectionHeader
          title={content.headline}
          subtitle={content.subheadline}
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <HubPathCard content={content.createPath} emphasized />
          <HubPathCard content={content.demosPath} />
        </div>
      </Container>
    </Section>
  );
}
