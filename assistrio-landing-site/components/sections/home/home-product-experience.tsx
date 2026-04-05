import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ProductExperienceVisuals } from "@/components/sections/home/product-experience-visuals";

type ProductExperienceProps = {
  embeddedInCarousel?: boolean;
};

/**
 * Section 3 — Product Experience: split layout, live-feeling product stack.
 */
export function HomeProductExperience({ embeddedInCarousel = false }: ProductExperienceProps = {}) {
  const inner = (
    <>
      {!embeddedInCarousel ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)] to-transparent" aria-hidden />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_75%_100%_at_50%_0%,rgba(13,148,136,0.085),transparent_72%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--background)]/90 via-transparent to-transparent blur-2xl"
            aria-hidden
          />
        </>
      ) : null}
      <Container size="wide" className="relative">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-x-14 xl:gap-x-20">
          <div id="product-experience-heading" className="scroll-mt-32 max-w-xl lg:max-w-none">
            <p className="text-eyebrow">Customize it</p>
            <h2 className="text-home-h2 text-home-h2-premium mt-6 max-w-[min(100%,24rem)] text-balance sm:max-w-xl">Make it unmistakably yours</h2>
            <p className="mt-5 max-w-2xl text-pretty text-[1.0625rem] font-semibold leading-snug tracking-tight text-slate-800 sm:text-lg lg:text-[1.125rem]">
              Branding, knowledge, leads, and analytics — one place to shape how the world meets your AI support, before a single visitor sees the thread.
            </p>
            <p className="mt-5 max-w-xl text-pretty text-[1.0625rem] leading-[1.72] text-[var(--foreground-muted)] sm:max-w-[40rem] sm:text-[1.0625rem]">
              This is the <strong className="font-semibold text-slate-800">control room</strong>: train and tune your agent, publish to the allowed websites you trust, and read the signals
              that tell you what to fix next — without jumping across five disconnected tools.
            </p>
            <ul className="mt-8 space-y-3.5 text-[0.9375rem] leading-relaxed text-[var(--foreground-muted)]">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)] shadow-[0_0_8px_rgba(13,148,136,0.45)]" aria-hidden />
                <span>
                  <strong className="font-semibold text-slate-800">Dashboard</strong> — agents, knowledge, publish targets, and team workflows in one shell.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)] shadow-[0_0_8px_rgba(13,148,136,0.45)]" aria-hidden />
                <span>
                  <strong className="font-semibold text-slate-800">Visitor widget</strong> — the runtime your site embeds; same path from preview to production.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)] shadow-[0_0_8px_rgba(13,148,136,0.45)]" aria-hidden />
                <span>
                  <strong className="font-semibold text-slate-800">Insights</strong> — conversation patterns beside configuration, so improvements stay grounded in real chats.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)] shadow-[0_0_8px_rgba(13,148,136,0.45)]" aria-hidden />
                <span>
                  <strong className="font-semibold text-slate-800">Brand controls</strong> — color, surfaces, launcher, and thread chrome aligned with your product.
                </span>
              </li>
            </ul>
            <p className="text-meta mt-8 max-w-md border-l-2 border-[var(--brand-teal)]/35 pl-4 leading-relaxed">
              Depth on branding, knowledge, leads, and analytics lives in Everything you control — without repeating specs here. Runtime stays on{" "}
              <strong className="font-semibold text-slate-700">allowed websites</strong>; workspace access stays{" "}
              <strong className="font-semibold text-slate-700">team-scoped</strong>.
            </p>
          </div>

          <div className="mt-14 lg:mt-2">
            <ProductExperienceVisuals />
          </div>
        </div>
      </Container>
    </>
  );

  if (embeddedInCarousel) {
    return (
      <div id="product-experience" className="relative bg-transparent py-0">
        {inner}
      </div>
    );
  }

  return (
    <Section
      id="product-experience"
      fillViewport
      spacing="loose"
      className="relative border-b border-[var(--border-default)] bg-gradient-to-b from-white via-slate-50/50 to-[var(--background)]"
    >
      {inner}
    </Section>
  );
}
