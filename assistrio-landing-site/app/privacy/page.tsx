import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Assistrio handles information on this marketing site.",
};

export default function PrivacyPage() {
  return (
    <Section spacing="default" className="border-b border-[var(--border-default)] bg-white">
      <Container size="compact" className="max-w-2xl">
        <PageIntro eyebrow="Legal" title="Privacy Policy">
          <p className="text-page-meta">Last updated: April 2026</p>
        </PageIntro>
        <div className="mt-10 max-w-none space-y-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
          <section>
            <h2 className="text-base font-semibold text-slate-900">What this site collects</h2>
            <p className="mt-2">
              This marketing site may store a browser identifier (for example <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code>)
              to support Explore, gallery demos, and anonymous usage summaries. Technical logs may include IP address and
              user agent when you use forms or APIs.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900">Contact form</h2>
            <p className="mt-2">
              If you use the contact form, we process the name, email, and message you submit to respond to your request.
              Do not send passwords or highly sensitive data through the form.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900">Third parties</h2>
            <p className="mt-2">
              Email delivery may use a provider (for example Resend) to transmit messages to our support inbox. Their
              processing is governed by their policies and our configuration.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900">Your choices</h2>
            <p className="mt-2">
              You can clear site data in your browser or contact{" "}
              <a href="mailto:support@assistrio.com" className="font-medium text-[var(--brand-teal-dark)]">
                support@assistrio.com
              </a>{" "}
              for privacy-related requests.
            </p>
          </section>
          <p className="text-xs text-[var(--foreground-subtle)]">
            This summary is for transparency on the marketing site and is not a substitute for a full legal review.
            Product terms may differ for paid services.
          </p>
          <p>
            <Link href="/contact" className="font-medium text-[var(--brand-teal-dark)]">
              Contact
            </Link>
          </p>
        </div>
      </Container>
    </Section>
  );
}
