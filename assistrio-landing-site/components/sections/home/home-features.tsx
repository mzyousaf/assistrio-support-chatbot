import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const features: {
  title: string;
  body: string;
  highlight?: boolean;
}[] = [
  {
    title: "Grounded in your knowledge",
    body: "Replies cite what you connect — help centers, FAQs, and docs — so answers match how your product actually works.",
  },
  {
    title: "Preview vs runtime",
    body: "Iterate in Assistrio preview; ship runtime only on domains you allow. Two pipelines — no accidental customer exposure.",
    highlight: true,
  },
  {
    title: "Domain-safe embeds",
    body: "Hostname and origin checks run server-side. Keys and allowlists gate access — CORS only lets browsers read responses.",
  },
  {
    title: "Trials & demos without friction",
    body: "Showcase demos on shared quota, or a visitor-owned trial bot with your allowlisted hostname — no card to start.",
  },
];

export function HomeFeatures() {
  return (
    <Section id="features" className="relative bg-white">
      <Container>
        <HomeSectionHeader id="features-heading" eyebrow="Capabilities" title="What you get">
          <p className="max-w-2xl text-base leading-relaxed">
            Accuracy, separation of surfaces, and deployable runtime — without blurring preview, production, or identity.
          </p>
        </HomeSectionHeader>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {features.map((f) => (
            <Card
              key={f.title}
              className={
                f.highlight
                  ? "border-[var(--border-teal-soft)] bg-gradient-to-br from-white to-[var(--brand-teal-subtle)]/25 ring-1 ring-[var(--brand-teal)]/10"
                  : "border-[var(--border-default)] bg-white/95"
              }
            >
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{f.body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
