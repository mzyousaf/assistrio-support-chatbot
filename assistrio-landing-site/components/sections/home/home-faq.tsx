import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const faqs: { q: string; a: string }[] = [
  {
    q: "What’s the difference between gallery live examples and Try it free?",
    a: "Gallery examples run here with shared demo quota so you can browse quickly. Try it free creates your own evaluation AI Support Agent: it’s tied to your workspace key and the allowed website you set for production-style runtime on your site.",
  },
  {
    q: "Do I need an account to start?",
    a: "Explore starts without a card — your browser keeps a session so quota and reconnect behave predictably. Launch and Enterprise are agreed with our team outside this flow.",
  },
  {
    q: "Where does preview run?",
    a: "Owner preview and drafts run in Assistrio product UIs. Customer-facing chat is runtime on your allowed website — not preview on this marketing site.",
  },
  {
    q: "How do I embed on my site?",
    a: "After you create your evaluation AI Support Agent, you get a runtime snippet with the credentials your embed needs. Your page must be served on the allowed website you configured; the API enforces origin and key rules.",
  },
];

export function HomeFaq() {
  return (
    <Section id="faq" className="border-b border-[var(--border-default)] bg-white">
      <Container size="narrow">
        <ScrollReveal y={18}>
          <HomeSectionHeader id="faq-heading" eyebrow="FAQ" title="Common questions">
            <p className="max-w-2xl text-base leading-relaxed">
              Short answers — Explore and gallery flows carry the full detail.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>
        <dl className="mt-10 space-y-4">
          {faqs.map((item) => (
            <div
              key={item.q}
              className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white/95 px-5 py-5 shadow-[var(--shadow-xs)] ring-1 ring-slate-900/[0.03] transition-[border-color,box-shadow] hover:border-[var(--border-teal-soft)] hover:shadow-[var(--shadow-sm)] sm:px-6 sm:py-5"
            >
              <dt className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-slate-900 sm:text-[1.0625rem]">
                {item.q}
              </dt>
              <dd className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
