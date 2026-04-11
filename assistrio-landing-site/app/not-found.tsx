import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLink } from "@/components/ui/button";
import { marketingPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingPageMetadata({
  title: "Page not found",
  description:
    "We could not find that page on Assistrio. Go home to explore AI Support Agents, the live gallery, and how to launch on your website.",
});

export default function NotFound() {
  return (
    <Section spacing="default" className="border-b border-[var(--border-default)] bg-white py-16 sm:py-24">
      <Container size="narrow" className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">404</p>
        <h1 className="mt-2 text-page-title">Page not found</h1>
        <p className="mt-4 text-page-lead text-[var(--foreground-muted)]">
          The link may be broken or the page may have moved. Try the homepage, gallery, or contact us if you need help.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="primary">
            Home
          </ButtonLink>
          <ButtonLink href="/gallery" variant="secondary">
            Live gallery
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact
          </ButtonLink>
        </div>
        <p className="mt-10 text-sm text-[var(--foreground-muted)]">
          Looking for a specific AI agent?{" "}
          <Link href="/gallery" className="font-medium text-[var(--brand-teal-dark)] underline-offset-4 hover:underline">
            Browse the showcase
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
