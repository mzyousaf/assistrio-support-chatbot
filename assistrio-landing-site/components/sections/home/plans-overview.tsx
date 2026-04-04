import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";

const plans = [
  {
    name: "Free trial",
    bestFor: "Validating embed + hostname rules on staging or localhost.",
    blurb: "Visitor-owned trial bot with your stable id and hostname allowlist — ideal before you commit to hosted or private.",
    cta: "Start trial",
    href: "/trial",
    variant: "primary" as const,
  },
  {
    name: "Hosted",
    bestFor: "Teams that want Assistrio to run the stack end-to-end.",
    blurb: "We host and operate the bot — scaling, updates, and delivery on our infrastructure. Terms negotiated with our team.",
    cta: "View pricing",
    href: "/pricing",
    variant: "secondary" as const,
  },
  {
    name: "Private deployment",
    bestFor: "Strict data residency, networking, or compliance needs.",
    blurb: "Run inside your environment with engineering handoff and scoped support — discussed during sales.",
    cta: "Contact us",
    href: "/contact",
    variant: "secondary" as const,
  },
];

export function PlansOverview() {
  return (
    <Section
      id="pricing"
      tone="muted"
      className="border-y border-[var(--border-default)] bg-gradient-to-b from-slate-50/90 to-[var(--background)]"
    >
      <Container>
        <HomeSectionHeader id="pricing-heading" eyebrow="Pricing" title="Plans at a glance">
          <p className="max-w-2xl text-base leading-relaxed">
            Three paths from experiment to production — hosted and private list prices are negotiated; use the CTAs for detail.
          </p>
        </HomeSectionHeader>
        <div className="mt-12 grid gap-6 sm:gap-8 lg:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.name}
              className="flex flex-col border-[var(--border-default)] bg-white/95 p-6 sm:p-7"
            >
              <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">{p.name}</h3>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal-dark)]">Best for</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{p.bestFor}</p>
              <p className="mt-4 flex-1 border-t border-[var(--border-default)] pt-4 text-sm leading-relaxed text-[var(--foreground-muted)]">
                {p.blurb}
              </p>
              <ButtonLink href={p.href} variant={p.variant} className="mt-8 w-full justify-center">
                {p.cta}
              </ButtonLink>
            </Card>
          ))}
        </div>
        <p className="mt-12 text-center text-sm text-[var(--foreground-muted)]">
          Compare paths in depth —{" "}
          <Link href="/pricing" className="link-inline font-medium">
            full pricing
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
