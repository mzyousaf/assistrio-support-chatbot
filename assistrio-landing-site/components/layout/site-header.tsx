"use client";

import Link from "next/link";
import { Container } from "@/components/layout/container";
import { TrackedCtaLink } from "@/components/analytics/tracked-cta-link";
import { useTrackEvent } from "@/hooks/useTrackEvent";

const nav = [
  { href: "/gallery", label: "Demos" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const { track } = useTrackEvent();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-white/85 shadow-[var(--shadow-xs)] backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <Container className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4">
        <Link
          href="/"
          className="shrink-0 font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-slate-900 transition-opacity duration-150 hover:opacity-85 sm:text-lg"
        >
          Assistrio
        </Link>
        <nav className="flex min-w-0 flex-1 items-center justify-center gap-0.5 px-1 sm:gap-1 md:flex-none md:justify-end md:px-0">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => track("cta_clicked", { location: "site_header_nav", label: item.label, href: item.href })}
              className="shrink-0 rounded-[var(--radius-sm)] px-2 py-1.5 text-[0.8125rem] font-medium text-[var(--foreground-muted)] transition-colors duration-150 hover:bg-slate-100/80 hover:text-[var(--brand-teal-dark)] sm:px-3 sm:text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <TrackedCtaLink href="/gallery" variant="ghost" location="site_header" label="Browse demos" className="hidden sm:inline-flex">
            Browse demos
          </TrackedCtaLink>
          <TrackedCtaLink href="/trial" location="site_header" label="Free trial" className="px-3 py-2 text-xs sm:px-5 sm:text-sm">
            Free trial
          </TrackedCtaLink>
        </div>
      </Container>
    </header>
  );
}
