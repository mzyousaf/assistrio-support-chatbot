import Link from "next/link";
import { Container } from "@/components/layout/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-default)] bg-white/90 py-14 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
      <Container className="flex flex-col gap-10 sm:flex-row sm:justify-between">
        <div className="max-w-sm">
          <p className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-900">Assistrio</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
            AI support chat grounded in your knowledge — trials, showcase demos, and domain-safe runtime embeds.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-3 text-sm text-[var(--foreground-muted)]">
          <Link href="/pricing" className="link-inline rounded-[var(--radius-sm)] transition-colors">
            Pricing
          </Link>
          <Link href="/gallery" className="link-inline rounded-[var(--radius-sm)] transition-colors">
            Showcase demos
          </Link>
          <Link href="/trial" className="link-inline rounded-[var(--radius-sm)] transition-colors">
            Free trial
          </Link>
          <Link href="/contact" className="link-inline rounded-[var(--radius-sm)] transition-colors">
            Contact
          </Link>
        </div>
      </Container>
    </footer>
  );
}
