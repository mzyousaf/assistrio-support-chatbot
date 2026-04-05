import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const pillars = [
  {
    title: "Presence that feels human",
    body: "Visitors meet a calm, on-brand thread the moment they need help — not a dead FAQ or a queue they will not join. You show up when it matters, even when your team is offline.",
  },
  {
    title: "One system, not ten tools",
    body: "Assistrio is the layer where knowledge, conversation, leads, and insight live together. Less context-switching, fewer handoffs, and a single story from evaluation to production.",
  },
  {
    title: "A partner in the hard parts",
    body: "We operate the hosted runtime, ship maintenance, and stand behind reliability — so you are not hiring a platform team to keep chat alive. Enterprise teams still get ownership when that is the right fit.",
  },
];

type CoreValueProps = {
  embeddedInCarousel?: boolean;
};

/**
 * Section 4 — Core Value: product value framing (structure unchanged).
 */
export function HomeCoreValue({ embeddedInCarousel = false }: CoreValueProps = {}) {
  const inner = (
    <>
      {!embeddedInCarousel ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 -top-16 h-36 bg-[radial-gradient(ellipse_90%_100%_at_50%_0%,rgba(248,250,252,0.9),transparent_65%)] blur-2xl"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)]/70 to-transparent" aria-hidden />
        </>
      ) : null}
      <Container>
        <ScrollReveal y={20}>
          <HomeSectionHeader
            id="core-value-heading"
            eyebrow="The complete picture"
            title="Everything Assistrio gives your business"
            titleWide
            titleVariant="premium"
            align="split"
            lead="Not a chat widget bolted onto your site — a full support experience your customers feel and your team can steer."
          >
            <p>
              You get <strong className="font-semibold text-slate-800">always-on coverage</strong> for the questions that repeat, the moments that convert, and the handoffs that
              need context. Underneath is a serious product: branding, knowledge, leads, analytics, and a runtime built for real traffic — whether you start on Explore or go
              straight to production.
            </p>
          </HomeSectionHeader>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-3 sm:gap-5 lg:mt-16 lg:gap-8">
          {pillars.map((p, i) => (
            <ScrollReveal key={p.title} y={18} delay={i * 0.06}>
              <div className="group h-full rounded-2xl border border-[var(--border-default)] bg-gradient-to-br from-white to-slate-50/80 p-7 shadow-[var(--shadow-sm)] ring-1 ring-slate-900/[0.03] transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--brand-teal)_28%,var(--border-default))] hover:shadow-[var(--shadow-md)] sm:p-8">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-teal-subtle)] text-sm font-bold text-[var(--brand-teal-dark)] ring-1 ring-[var(--border-teal-soft)]">
                  {i + 1}
                </span>
                <h3 className="text-carousel-slide-title mt-5 text-pretty">{p.title}</h3>
                <p className="mt-4 text-[0.9375rem] leading-[1.72] text-[var(--foreground-muted)]">{p.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </>
  );

  if (embeddedInCarousel) {
    return (
      <div id="core-value" className="relative bg-transparent py-0">
        {inner}
      </div>
    );
  }

  return (
    <Section
      id="core-value"
      fillViewport
      spacing="default"
      className="relative border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--background)]/35 via-white to-slate-50/55"
    >
      {inner}
    </Section>
  );
}
