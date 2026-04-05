import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const pillars = [
  {
    title: "Grounded answers",
    body: "Bots draw from your knowledge base so replies stay aligned with how your product actually works.",
  },
  {
    title: "Try before you commit",
    body: "Gallery live examples use real runtime flows. Your Explore bot runs only on your allowed websites — not a generic mock.",
  },
  {
    title: "Clear separation of concerns",
    body: "Preview inside Assistrio is for owners testing changes. Customer-facing runtime is always on your allowed website with its own rules.",
  },
];

/**
 * Product positioning without fabricated logos, metrics, or testimonials.
 */
export function SocialProof() {
  return (
    <Section tone="muted" className="relative border-b border-[var(--border-default)]">
      <Container>
        <HomeSectionHeader eyebrow="Why Assistrio" title="Built for product and support teams">
          <p className="max-w-2xl text-base leading-relaxed">
            No vanity metrics here — just how Assistrio is designed to work with your content and rollout model.
          </p>
        </HomeSectionHeader>
        <div className="mt-12 rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/80 p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {pillars.map((p) => (
              <Card key={p.title} className="border-[var(--border-default)] bg-white/90 p-5 shadow-none sm:p-6">
                <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{p.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
