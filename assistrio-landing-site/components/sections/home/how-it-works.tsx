import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const steps = [
  {
    title: "Stable anonymous id",
    body: "This site stores a platform visitor id (or you restore one). It anchors trial ownership, quota, and reconnect — separate from chat threads inside the widget.",
  },
  {
    title: "Showcase vs trial",
    body: "Gallery demos use shared showcase quota. Your trial bot is keyed to your id and the hostname you allowlist — that’s what production-style runtime uses.",
  },
  {
    title: "Preview stays in Assistrio",
    body: "Owners test drafts in Assistrio product UIs — not on your public marketing pages and not as a substitute for runtime on your domain.",
  },
  {
    title: "Embed on your domain",
    body: "Paste the runtime snippet where your hostname matches your rules. The API checks origin and credentials; identity and domain gates do the real authorization.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" className="relative bg-white">
      <Container>
        <HomeSectionHeader id="how-it-works-heading" eyebrow="Flow" title="From id to embed">
          <p className="max-w-2xl text-base leading-relaxed">
            Anonymous identity → demos or trial → runtime snippet on your site. Same public API model end to end.
          </p>
        </HomeSectionHeader>
        <ol className="mt-14 grid gap-5 sm:gap-6 lg:grid-cols-2">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative flex gap-4 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-slate-50/70 p-5 shadow-[var(--shadow-xs)] transition-shadow duration-200 hover:shadow-[var(--shadow-sm)] sm:gap-5 sm:p-6"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal)] text-sm font-bold text-white shadow-sm ring-4 ring-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
