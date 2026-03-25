import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLinkGroup } from "@/components/shared/button-link";
import { SectionHeader } from "@/components/shared/section-header";
import type { HomeWhyAssistrioContent } from "@/types/home";

type HomeWhyAssistrioProps = {
  content: HomeWhyAssistrioContent;
};

export function HomeWhyAssistrio({ content }: HomeWhyAssistrioProps) {
  return (
    <Section>
      <Container>
        <SectionHeader
          title={content.headline}
          subtitle={content.subheadline}
          description={content.body}
        />
        <div className="mt-12 overflow-x-auto rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">
              Comparison of Assistrio versus typical generic chatbots
            </caption>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th scope="col" className="px-5 py-4 font-semibold text-neutral-700">
                  Topic
                </th>
                <th scope="col" className="px-5 py-4 font-semibold text-brand">
                  Assistrio
                </th>
                <th scope="col" className="px-5 py-4 font-semibold text-neutral-600">
                  Typical generic bot
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {content.rows.map((row) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className="whitespace-nowrap px-5 py-4 font-medium text-neutral-900"
                  >
                    {row.label}
                  </th>
                  <td className="px-5 py-4 text-neutral-700">{row.assistrio}</td>
                  <td className="px-5 py-4 text-neutral-500">{row.typical}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
