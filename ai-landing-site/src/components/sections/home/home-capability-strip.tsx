import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/shared/button-link";
import type { HomeCapabilityStripContent } from "@/types/home";

type HomeCapabilityStripProps = {
  content: HomeCapabilityStripContent;
};

export function HomeCapabilityStrip({ content }: HomeCapabilityStripProps) {
  return (
    <div className="border-b border-neutral-100 bg-neutral-50/90">
      <Container className="py-8 md:py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 md:text-xl">
              {content.headline}
            </h2>
            <p className="mt-1 text-sm font-medium text-brand">
              {content.subheadline}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600 md:max-w-2xl">
              {content.body}
            </p>
          </div>
          {content.linkCta ? (
            <div className="shrink-0 md:pb-0.5">
              <ButtonLink
                href={content.linkCta.href}
                label={content.linkCta.label}
                variant="link"
              />
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
