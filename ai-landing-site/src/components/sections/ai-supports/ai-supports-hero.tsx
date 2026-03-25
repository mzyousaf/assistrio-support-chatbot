import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLink } from "@/components/shared/button-link";
import type { AiSupportsHeroContent } from "@/types/ai-supports";

type AiSupportsHeroProps = {
  content: AiSupportsHeroContent;
};

export function AiSupportsHero({ content }: AiSupportsHeroProps) {
  return (
    <Section
      spacious
      variant="accent"
      className="border-b border-neutral-100/80"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            AI Supports
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            {content.headline}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600 sm:text-xl">
            {content.subheadline}
          </p>
          {content.body ? (
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              {content.body}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <ButtonLink
              href={content.primaryCta.href}
              label={content.primaryCta.label}
              variant="primary"
            />
            <ButtonLink
              href={content.secondaryCta.href}
              label={content.secondaryCta.label}
              variant="secondary"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
