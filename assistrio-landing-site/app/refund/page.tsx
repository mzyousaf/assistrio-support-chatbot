import type { Metadata } from "next";
import Link from "next/link";
import { marketingPageMetadata } from "@/lib/site-metadata";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = marketingPageMetadata({
  title: "Refund Policy",
  description:
    "Assistrio refund policy for hosted AI Support Agent services — fees are generally non-refundable except where required by law or your signed agreement.",
  path: "/refund",
});

export default function RefundPage() {
  return (
    <Section spacing="default" className="border-b border-[var(--border-default)] bg-white">
      <Container size="narrow" className="max-w-3xl">
        <PageIntro eyebrow="Legal" title="Refund Policy" className="max-w-none">
          <p className="text-page-lead">
            This page summarizes how we treat refunds for Assistrio services. Your signed agreement or order form takes
            precedence if it says something different.
          </p>
        </PageIntro>

        <div className="mt-10 rounded-2xl border border-[var(--border-teal-soft)]/70 bg-[color-mix(in_srgb,var(--brand-teal-subtle)_42%,white)] p-6 shadow-[var(--shadow-sm)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_12%,transparent)] sm:p-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal-dark)]">At a glance</p>
          <p className="mt-3 text-page-lead">
            Unless otherwise required by applicable law or explicitly agreed in a signed order form,{" "}
            <strong>fees paid to Assistrio are non-refundable</strong>. We do not offer refunds on published commercial
            terms except where the law requires otherwise.
          </p>
        </div>

        <div className="mt-14 min-w-0 space-y-12 break-words border-t border-[var(--border-default)] pt-14">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Paid plans &amp; agreements</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
              Launch, Enterprise, and other paid offerings are scoped with our team. Commercial terms, billing cadence,
              and any exceptions are defined in your agreement — not on this marketing page alone.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Billing questions &amp; mistaken charges</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
              If you believe a charge is in error, contact{" "}
              <a href="mailto:support@assistrio.com" className="font-semibold text-[var(--brand-teal-dark)] underline decoration-[var(--border-teal-soft)] underline-offset-2 hover:decoration-[var(--brand-teal)]">
                support@assistrio.com
              </a>{" "}
              with your account details and invoice references. We will review in good faith and respond with next steps.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Related</h2>
            <ul className="space-y-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
              <li>
                <Link
                  href="/contact"
                  className="font-medium text-[var(--brand-teal-dark)] underline decoration-[var(--border-teal-soft)] underline-offset-2 hover:decoration-[var(--brand-teal)]"
                >
                  Contact form
                </Link>{" "}
                — for general inquiries and support.
              </li>
              <li>
                Product evaluations and trials are described on the{" "}
                <Link href="/trial" className="font-medium text-[var(--brand-teal-dark)] underline decoration-[var(--border-teal-soft)] underline-offset-2 hover:decoration-[var(--brand-teal)]">
                  explore
                </Link>{" "}
                page; commercial billing follows your contract when you upgrade.
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-14 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/90 p-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
          <p>
            Nothing on this page limits any mandatory rights you may have under consumer protection or other laws in your
            jurisdiction.
          </p>
        </div>
      </Container>
    </Section>
  );
}
