import type { Metadata } from "next";
import Link from "next/link";
import { marketingPageMetadata } from "@/lib/site-metadata";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = marketingPageMetadata({
  title: "About Assistrio",
  description:
    "Assistrio is a hosted platform for AI Support Agents on your allowed websites — knowledge base, lead capture, branding, and analytics in one product.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <Section spacing="default" className="border-b border-[var(--border-default)] bg-white">
        <Container size="narrow" className="max-w-4xl">
          <PageIntro eyebrow="Assistrio" title="About Assistrio" largeTitle className="max-w-3xl">
            <div className="space-y-4 text-page-lead">
              <p>
                Assistrio helps teams ship <strong>AI support</strong> that answers on your allowed websites, grounded in
                your knowledge, with branding and analytics in one product.
              </p>
              <p>
                You can <strong>try it free</strong>, browse <strong>live examples</strong> in the gallery, and move to
                hosted production when you are ready.
              </p>
            </div>
          </PageIntro>

          <div className="mt-14 grid min-w-0 gap-5 sm:grid-cols-3">
            {[
              {
                title: "Hosted agents",
                body: "Runtime embeds on domains you allow, with a dashboard to tune answers and review traffic.",
              },
              {
                title: "Your knowledge",
                body: "Ground responses in the docs and FAQs you provide — not generic filler.",
              },
              {
                title: "From trial to prod",
                body: "Start in evaluation, prove value with real visitors, then scale on commercial terms.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="flex flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--surface-muted)]/80 p-5 shadow-[var(--shadow-xs)] ring-1 ring-slate-900/[0.03] sm:p-6"
              >
                <p className="font-semibold text-slate-900">{card.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{card.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section spacing="default" tone="muted" className="border-b border-[var(--border-default)]">
        <Container size="narrow" className="max-w-4xl">
          <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:items-start">
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-display)] text-[1.35rem] font-normal tracking-tight text-slate-900 sm:text-[1.5rem]">
                What we focus on
              </h2>
              <ul className="mt-6 space-y-4 text-page-lead">
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
                  <span>Clear ownership: you control where the agent runs and what it is allowed to say.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
                  <span>Fast iteration: update knowledge and branding without redeploying your whole site.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
                  <span>Honest positioning: we are built for support on your properties — not a generic chatbot bolt-on.</span>
                </li>
              </ul>
            </div>

            <aside className="min-w-0 rounded-2xl border border-[var(--border-default)] bg-white p-6 shadow-[var(--shadow-sm)] ring-1 ring-slate-900/[0.04]">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">Next steps</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
                Questions about Launch, Enterprise, or your workspace? We are happy to help.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href="/gallery"
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-teal-soft)] hover:bg-[color-mix(in_srgb,var(--brand-teal-subtle)_40%,white)]"
                >
                  Browse live examples
                </Link>
                <Link
                  href="/trial"
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-teal-soft)] hover:bg-[color-mix(in_srgb,var(--brand-teal-subtle)_40%,white)]"
                >
                  Try it free
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-teal)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-teal-hover)]"
                >
                  Contact support
                </Link>
              </div>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
