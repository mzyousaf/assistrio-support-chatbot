import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { ContactPathCtas } from "@/components/contact/contact-path-ctas";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <>
      <Section
        spacing="compact"
        className="border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/25 to-transparent pb-10 pt-10 sm:pb-12 sm:pt-12"
      >
        <Container size="compact">
          <PageIntro eyebrow="Assistrio" title="Contact" className="max-w-xl">
            <p className="text-page-lead">
              For <strong className="font-medium text-slate-800">Hosted</strong> or{" "}
              <strong className="font-medium text-slate-800">Private deployment</strong>, use the sales or support channel
              you already have with Assistrio. This marketing build does not submit contact forms to a backend.
            </p>
          </PageIntro>
        </Container>
      </Section>

      <Section spacing="compact" className="pb-20 pt-12">
        <Container size="compact" className="max-w-lg">
          <p className="text-sm font-medium text-slate-800">Paths</p>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Explore the product first, or go straight to commercial conversations through your existing Assistrio contact.
          </p>
          <ContactPathCtas />
          <div className="mt-4 space-y-4">
            <Card className="border-[var(--border-default)] bg-slate-50/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Commercial</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
                Hosted and private deployment are scoped with our team — pricing and terms are agreed outside this site.
              </p>
              <p className="mt-3 text-sm text-[var(--foreground-muted)]">
                Use the email or channel you already have for Assistrio sales/support, or visit{" "}
                <Link href="/pricing" className="link-inline font-medium">
                  Pricing &amp; paths
                </Link>{" "}
                for context before you reach out.
              </p>
            </Card>
          </div>
        </Container>
      </Section>
    </>
  );
}
