import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLink, ButtonLinkGroup } from "@/components/shared/button-link";
import { SectionHeader } from "@/components/shared/section-header";
import type { HomeUseCasesContent } from "@/types/home";
import { cn } from "@/lib/cn";

type HomeUseCasesProps = {
  content: HomeUseCasesContent;
};

export function HomeUseCases({ content }: HomeUseCasesProps) {
  return (
    <Section>
      <Container>
        <SectionHeader
          title={content.headline}
          subtitle={content.subheadline}
        />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2">
          {content.items.map((item) => (
            <li
              key={item.title}
              className={cn(
                "flex flex-col rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm transition hover:border-brand/25 hover:shadow-md",
              )}
            >
              <h3 className="text-lg font-semibold text-neutral-900">
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">
                {item.description}
              </p>
              {item.cta ? (
                <ButtonLink
                  href={item.cta.href}
                  label={item.cta.label}
                  variant={item.cta.variant ?? "link"}
                  className="mt-4 w-fit"
                />
              ) : null}
            </li>
          ))}
        </ul>
        {content.sectionCtas.length > 0 ? (
          <ButtonLinkGroup
            items={content.sectionCtas.map((c) => ({
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
