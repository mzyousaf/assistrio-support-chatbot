import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Assistrio refund policy — no refunds on published commercial terms unless required by law.",
};

export default function RefundPage() {
  return (
    <Section spacing="default" className="border-b border-[var(--border-default)] bg-white">
      <Container size="compact" className="max-w-2xl">
        <PageIntro eyebrow="Legal" title="Refund Policy">
          <p className="text-page-lead">
            Unless otherwise required by applicable law or explicitly agreed in a signed order form,{" "}
            <strong className="font-medium text-slate-800">fees paid to Assistrio are non-refundable</strong>. We do not offer refunds on published commercial terms except where
            the law requires otherwise.
          </p>
        </PageIntro>
        <div className="mt-10 space-y-5 text-sm leading-relaxed text-[var(--foreground-muted)]">
          <p>
            Launch, Enterprise, and other paid offerings are scoped with our team. Commercial terms, billing cadence, and
            any exceptions are defined in your agreement — not on this marketing page alone.
          </p>
          <p>
            If you believe a charge is in error, contact{" "}
            <a href="mailto:support@assistrio.com" className="font-semibold text-[var(--brand-teal-dark)]">
              support@assistrio.com
            </a>{" "}
            with your account details and we will review in good faith.
          </p>
          <p>
            <Link href="/contact" className="font-medium text-[var(--brand-teal-dark)]">
              Open contact form
            </Link>
          </p>
        </div>
      </Container>
    </Section>
  );
}
