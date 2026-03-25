import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLink } from "@/components/shared/button-link";
import { BotPreviewCard } from "@/components/shared/bot-preview-card";
import { SectionHeader } from "@/components/shared/section-header";
import type { HomePublicBotsPreviewContent } from "@/types/home";

type HomePublicBotsPreviewProps = {
  content: HomePublicBotsPreviewContent;
};

export function HomePublicBotsPreview({ content }: HomePublicBotsPreviewProps) {
  return (
    <Section variant="subtle">
      <Container>
        <SectionHeader
          title={content.headline}
          subtitle={content.subheadline}
          description={content.body}
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {content.bots.map((bot) => (
            <BotPreviewCard key={bot.id} bot={bot} />
          ))}
        </div>
        <div className="mt-10 flex justify-center sm:justify-start">
          <ButtonLink
            href={content.viewAllCta.href}
            label={content.viewAllCta.label}
            variant={content.viewAllCta.variant ?? "primary"}
          />
        </div>
      </Container>
    </Section>
  );
}
