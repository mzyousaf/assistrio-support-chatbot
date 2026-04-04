import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free trial, hosted, and private deployment options for Assistrio AI support chat.",
};

const tiers = [
  {
    name: "Free trial",
    priceLabel: "No card required",
    bestFor: "Localhost, staging, and first production experiments.",
    description:
      "Create a visitor-owned trial bot with the same stable id this site uses for anonymous flows. You set the runtime hostname; the API enforces it server-side.",
    bullets: [
      "Stable anonymous id + domain-based runtime (backend rules)",
      "Preview and runtime quota tracked separately",
      "Self-serve from this marketing site",
    ],
    primary: "Start trial",
    href: "/trial",
    highlight: false,
  },
  {
    name: "Hosted",
    priceLabel: "Talk to us",
    bestFor: "Teams that want uptime and operations handled by Assistrio.",
    description:
      "Assistrio hosts and operates your bot — we handle uptime, scaling, and delivery so your team can focus on content and workflows.",
    bullets: [
      "Fully managed infrastructure on Assistrio",
      "Productized upgrades as we ship them",
      "Commercial terms agreed with our team",
    ],
    primary: "Contact sales",
    href: "/contact",
    highlight: true,
  },
  {
    name: "Private deployment",
    priceLabel: "Talk to us",
    bestFor: "Strict data residency, VPC, or custom networking.",
    description:
      "Receive the software and deployment patterns to run inside your own environment — for teams with strict data residency or custom networking needs.",
    bullets: [
      "You control hosting and release cadence",
      "Engineering handoff and documentation",
      "Scoped to what we can support technically — discussed during sales",
    ],
    primary: "Contact us",
    href: "/contact",
    highlight: false,
  },
];

/** Honest comparison — no list prices or invented fees */
const comparisonRows: { label: string; trial: string; hosted: string; private: string }[] = [
  {
    label: "How you start",
    trial: "Self-serve from /trial",
    hosted: "Sales conversation",
    private: "Sales + technical scoping",
  },
  {
    label: "Where it runs",
    trial: "Your allowlisted domains (embed)",
    hosted: "Assistrio infrastructure",
    private: "Infrastructure you operate",
  },
  {
    label: "Operations",
    trial: "You manage your embed + content",
    hosted: "Assistrio operates the service",
    private: "Your platform team",
  },
  {
    label: "Commercial terms",
    trial: "Trial limits per product policy",
    hosted: "Contract with Assistrio",
    private: "Contract + support scope",
  },
];

export default function PricingPage() {
  return (
    <>
      <Section
        spacing="compact"
        className="relative overflow-hidden border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/40 via-white to-transparent pb-14 pt-12 sm:pb-16 sm:pt-16"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(13,148,136,0.1),transparent_70%)]"
          aria-hidden
        />
        <Container className="relative">
          <PageIntro eyebrow="Plans" title="Pricing & paths" largeTitle className="max-w-2xl">
            <p className="text-page-lead">
              Three product paths — from anonymous trial to fully managed or self-hosted. List pricing is not published
              here yet; use the CTAs to talk with us for Hosted and Private deployment.
            </p>
          </PageIntro>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-8 lg:grid-cols-3 lg:items-stretch">
            {tiers.map((t) => (
              <Card
                key={t.name}
                className={`flex flex-col p-6 sm:p-7 ${
                  t.highlight
                    ? "border-[var(--border-teal-soft)] shadow-[var(--shadow-teal-glow)] ring-1 ring-[var(--brand-teal)]/15 lg:scale-[1.02] lg:shadow-[var(--shadow-md)]"
                    : "border-[var(--border-default)]"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-teal-dark)]">
                  {t.priceLabel}
                </p>
                <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">
                  {t.name}
                </h2>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Best for</p>
                <p className="mt-1 text-sm font-medium leading-snug text-slate-800">{t.bestFor}</p>
                <p className="mt-4 border-t border-[var(--border-default)] pt-4 text-sm leading-relaxed text-[var(--foreground-muted)]">
                  {t.description}
                </p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Included</p>
                <ul className="mt-2 flex-1 space-y-2.5 text-sm text-[var(--foreground-muted)]">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-teal)]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={t.href}
                  className="mt-8 w-full justify-center"
                  variant={t.name === "Free trial" ? "primary" : "secondary"}
                >
                  {t.primary}
                </ButtonLink>
              </Card>
            ))}
          </div>

          <div className="mt-16 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white/90 p-6 shadow-[var(--shadow-sm)] sm:p-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900 sm:text-2xl">
              At a glance
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--foreground-muted)]">
              High-level differences — not a substitute for a commercial proposal. No per-seat or usage pricing is shown
              here.
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="py-3 pr-4 font-medium text-slate-900" scope="col" />
                    <th className="px-3 py-3 font-semibold text-slate-900" scope="col">
                      Free trial
                    </th>
                    <th className="px-3 py-3 font-semibold text-[var(--brand-teal-dark)]" scope="col">
                      Hosted
                    </th>
                    <th className="px-3 py-3 font-semibold text-slate-900" scope="col">
                      Private deployment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b border-[var(--border-default)] last:border-0">
                      <th className="py-3 pr-4 font-medium text-slate-700" scope="row">
                        {row.label}
                      </th>
                      <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.trial}</td>
                      <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.hosted}</td>
                      <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.private}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-12 text-center text-page-meta">
            Curious about showcase demos first?{" "}
            <Link href="/gallery" className="link-inline">
              Browse the gallery
            </Link>
            .
          </p>
        </Container>
      </Section>
    </>
  );
}
