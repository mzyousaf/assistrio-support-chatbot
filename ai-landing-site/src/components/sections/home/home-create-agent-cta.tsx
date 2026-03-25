import { ButtonLink } from "@/components/shared/button-link";
import { CtaBand } from "@/components/shared/cta-band";
import type { HomeCreateAgentCtaContent } from "@/types/home";

type HomeCreateAgentCtaProps = {
  content: HomeCreateAgentCtaContent;
};

export function HomeCreateAgentCta({ content }: HomeCreateAgentCtaProps) {
  return (
    <CtaBand variant="gradient">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            {content.headline}
          </h2>
          <p className="mt-3 text-lg text-neutral-600">{content.subheadline}</p>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600 sm:text-base">
            {content.body}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
          <ButtonLink
            href={content.primaryCta.href}
            label={content.primaryCta.label}
            variant="primary"
          />
          {content.secondaryCta ? (
            <ButtonLink
              href={content.secondaryCta.href}
              label={content.secondaryCta.label}
              variant="secondary"
            />
          ) : null}
        </div>
      </div>
    </CtaBand>
  );
}
