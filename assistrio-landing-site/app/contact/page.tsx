import type { Metadata } from "next";
import Link from "next/link";
import { marketingPageMetadata } from "@/lib/site-metadata";
import { ContactForm } from "@/components/contact/contact-form";
import { Container } from "@/components/layout/container";
import { PageIntro } from "@/components/layout/page-intro";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = marketingPageMetadata({
  title: "Contact",
  description:
    "Contact Assistrio about Launch, Enterprise, or your workspace — or message support@assistrio.com. We help with hosted AI Support Agents, security reviews, and rollout.",
  path: "/contact",
});

const CONTACT_TITLE_ID = "contact-page-heading";

export default function ContactPage() {
  return (
    <Section
      fillViewport
      spacing="loose"
      className="border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/20 via-white to-[var(--background)] py-14 sm:py-20"
    >
      <Container size="default" className="max-w-6xl">
        <div className="grid min-w-0 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-16 lg:items-start">
          <div className="min-w-0 space-y-8 lg:sticky lg:top-28">
            <PageIntro eyebrow="Support" title="Contact us" titleId={CONTACT_TITLE_ID} className="max-w-lg">
              <p className="text-page-lead">
                Launch timelines, security reviews, billing — tell us what you need. We read every message at{" "}
                <strong>support@assistrio.com</strong> and usually reply within one to two business days.
              </p>
            </PageIntro>

            <ul className="space-y-4">
              {[
                {
                  title: "Sales & plans",
                  body: "Hosted capacity, rollout, and what is included in Launch or Enterprise.",
                },
                {
                  title: "Product support",
                  body: "Workspace issues, embeds on allowed sites, and how to get the most from your agents.",
                },
                {
                  title: "Partnerships",
                  body: "Integration questions — we will route you to the right person.",
                },
              ].map((item) => (
                <li
                  key={item.title}
                  className="flex gap-4 rounded-xl border border-[var(--border-default)] bg-white/80 p-4 shadow-[var(--shadow-xs)] ring-1 ring-slate-900/[0.03]"
                >
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--brand-teal-subtle)_85%,white)] text-[var(--brand-teal-dark)]"
                    aria-hidden
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-[var(--border-teal-soft)]/60 bg-[color-mix(in_srgb,var(--brand-teal-subtle)_35%,white)] p-5 text-sm leading-relaxed text-[var(--foreground-muted)]">
              <p className="font-semibold text-[var(--brand-teal-dark)]">Before you write</p>
              <p className="mt-2">
                Evaluations and demos are also available from the{" "}
                <Link
                  href="/gallery"
                  className="font-medium text-[var(--brand-teal-dark)] underline decoration-[var(--border-teal-soft)] underline-offset-2 hover:decoration-[var(--brand-teal)]"
                >
                  gallery
                </Link>{" "}
                and{" "}
                <Link
                  href="/trial"
                  className="font-medium text-[var(--brand-teal-dark)] underline decoration-[var(--border-teal-soft)] underline-offset-2 hover:decoration-[var(--brand-teal)]"
                >
                  explore
                </Link>{" "}
                pages — no credit card required to get started.
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <ContactForm variant="split" labelledBy={CONTACT_TITLE_ID} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
