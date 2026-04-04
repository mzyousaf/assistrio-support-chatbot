import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const cases = [
  {
    tag: "Support",
    title: "Customer support",
    body: "Deflect repetitive tickets with grounded answers from help centers and FAQs — escalation paths stay aligned with your policy.",
  },
  {
    tag: "Product",
    title: "Product & SaaS docs",
    body: "Embed beside developer docs or in-app so users get consistent explanations without leaving your product surface.",
  },
  {
    tag: "Internal",
    title: "Internal enablement",
    body: "Give sales and success one place to ask how features work — wired to the same knowledge your team already maintains.",
  },
];

export function HomeUseCases() {
  return (
    <Section id="use-cases" tone="muted" className="border-y border-[var(--border-default)]">
      <Container>
        <HomeSectionHeader id="use-cases-heading" eyebrow="Use cases" title="Where teams deploy Assistrio">
          <p className="max-w-2xl text-base leading-relaxed">
            One runtime model — you choose which domains and content back the widget.
          </p>
        </HomeSectionHeader>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {cases.map((c) => (
            <Card key={c.title} className="border-[var(--border-default)] bg-white/95 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">{c.tag}</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{c.body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
