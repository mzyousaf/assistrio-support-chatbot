import Link from "next/link";
import { Container } from "@/components/layout/container";
import { FooterFlowCtas } from "@/components/layout/footer-flow-ctas";

const linkClass =
  "text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:text-[var(--brand-teal-dark)]";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/80 py-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:py-16">
      <Container>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Assistrio</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
              AI support on your allowed websites — try it free, see live examples, or reach us when you are ready to launch.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                Legal & contact
              </p>
              <nav aria-label="Legal and contact" className="mt-4 flex flex-col gap-3">
                <Link href="/contact" className={linkClass}>
                  Contact
                </Link>
                {/* <Link href="/pricing" className={linkClass}>
                  Pricing
                </Link> */}
                <Link href="/about" className={linkClass}>
                  About Assistrio
                </Link>
                <Link href="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
                <Link href="/refund" className={linkClass}>
                  Refund Policy
                </Link>
              </nav>
            </div>

            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
                Get started
              </p>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">Try it free first, then explore live examples.</p>
              <div className="mt-4">
                <FooterFlowCtas />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-12 border-t border-[var(--border-default)] pt-8 text-center text-xs text-[var(--foreground-subtle)]">
          © {new Date().getFullYear()} Assistrio. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
