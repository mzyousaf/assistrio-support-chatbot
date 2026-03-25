import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/shared/section-header";
import type { AiSupportsWhatItDoesContent } from "@/types/ai-supports";
import { cn } from "@/lib/cn";

type AiSupportsWhatItDoesProps = {
  content: AiSupportsWhatItDoesContent;
};

export function AiSupportsWhatItDoes({ content }: AiSupportsWhatItDoesProps) {
  return (
    <Section>
      <Container>
        <SectionHeader title={content.headline} subtitle={content.subheadline} />
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {content.items.map((item) => (
            <li
              key={item.title}
              className={cn(
                "rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm",
              )}
            >
              <h3 className="text-lg font-semibold text-neutral-900">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
