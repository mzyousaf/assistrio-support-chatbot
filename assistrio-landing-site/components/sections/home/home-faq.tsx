import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const faqs: { q: string; a: string }[] = [
  {
    q: "What’s the difference between showcase demos and a trial bot?",
    a: "Showcase bots run on this site with shared demo quota for your stable id. A trial bot is yours: it’s tied to your id and the hostname you allowlist for production-style runtime on your domain.",
  },
  {
    q: "Do I need an account to start?",
    a: "Anonymous trials use a browser-generated stable id — no card to create a trial bot. Hosted and private deployment are agreed with our team outside this flow.",
  },
  {
    q: "Where does preview run?",
    a: "Owner preview and drafts run in Assistrio product UIs. Customer-facing chat is runtime on your allowlisted domain — not preview on this marketing site.",
  },
  {
    q: "How do I embed on my site?",
    a: "After creating a trial bot, you get a runtime snippet with bot id, access key, and stable id. Your page hostname must match what you configured; the API enforces origin and key rules.",
  },
];

export function HomeFaq() {
  return (
    <Section id="faq" className="border-b border-[var(--border-default)] bg-white">
      <Container size="narrow">
        <HomeSectionHeader id="faq-heading" eyebrow="FAQ" title="Common questions">
          <p className="max-w-2xl text-base leading-relaxed">
            Short answers — trial and gallery flows have the full detail.
          </p>
        </HomeSectionHeader>
        <dl className="mt-10 space-y-3">
          {faqs.map((item) => (
            <div
              key={item.q}
              className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-slate-50/60 px-5 py-4 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]"
            >
              <dt className="font-semibold text-slate-900">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
