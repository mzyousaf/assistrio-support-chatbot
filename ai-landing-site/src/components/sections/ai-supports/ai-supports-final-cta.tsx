import { ButtonLink } from "@/components/shared/button-link";
import { CtaBand } from "@/components/shared/cta-band";
import type { AiSupportsFinalCtaContent } from "@/types/ai-supports";

type AiSupportsFinalCtaProps = {
  content: AiSupportsFinalCtaContent;
};

export function AiSupportsFinalCta({ content }: AiSupportsFinalCtaProps) {
  return (
    <CtaBand variant="gradient" className="border-b-0">
      <div className="text-center">
        <h2 className="mx-auto max-w-2xl text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          {content.headline}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-neutral-600">
          {content.subheadline}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
          {content.body}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
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
    </CtaBand>
  );
}
