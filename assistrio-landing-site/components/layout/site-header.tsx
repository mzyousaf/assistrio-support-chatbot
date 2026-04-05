"use client";

import Link from "next/link";
import { Container } from "@/components/layout/container";
import { TrackedFlowCtaButton } from "@/components/flows/tracked-flow-cta";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-white/92 shadow-[var(--shadow-xs)] backdrop-blur-md supports-[backdrop-filter]:bg-white/78">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)]/40 to-transparent" aria-hidden />
      <Container className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4">
        <Link
          href="/"
          className="shrink-0 font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-slate-900 transition-opacity duration-150 hover:opacity-85 sm:text-lg"
        >
          Assistrio
        </Link>

        <nav aria-label="Primary actions" className="flex shrink-0 items-center gap-2 sm:gap-3">
          <TrackedFlowCtaButton
            flow="trial"
            href="/trial"
            location="site_header"
            label="Try it free"
            variant="primary"
            className="btn-primary-shimmer rounded-full px-4 py-2 text-[0.8125rem] font-semibold shadow-[var(--shadow-sm)] ring-1 ring-white/15 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Try it free
          </TrackedFlowCtaButton>
          <TrackedFlowCtaButton
            flow="showcase"
            href="/gallery"
            location="site_header"
            label="See Live Examples"
            variant="secondary"
            className="rounded-full border border-[var(--border-teal-soft)] px-2.5 py-2 text-[0.7rem] font-semibold shadow-[var(--shadow-xs)] sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">Live examples</span>
            <span className="hidden sm:inline">See Live Examples</span>
          </TrackedFlowCtaButton>
        </nav>
      </Container>
    </header>
  );
}
