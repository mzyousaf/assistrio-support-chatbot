import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { FooterFlowCtas } from "@/components/layout/footer-flow-ctas";
import { SITE_LOGO, SITE_LOGO_WORDMARK_PX } from "@/lib/site-branding";

const linkClass =
  "text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:text-[var(--brand-teal-dark)]";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/80 py-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:py-16">
      <Container>
        <div className="flex min-w-0 flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-sm">
            <p className="flex items-center gap-2.5 text-slate-900">
              <Image
                src={SITE_LOGO.sm}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-lg object-contain"
                aria-hidden
              />
              <Image
                src={SITE_LOGO.wordmark}
                alt="Assistrio"
                width={SITE_LOGO_WORDMARK_PX.width}
                height={SITE_LOGO_WORDMARK_PX.height}
                className="h-5 w-auto max-w-[7rem] object-contain object-left sm:h-[22px] sm:max-w-[8.25rem]"
              />
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
              AI support on your allowed websites — try it free, see live AI Support Agents, or reach us when you are ready to launch.
            </p>
          </div>

          <div className="grid min-w-0 gap-8 sm:grid-cols-2 lg:gap-14">
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
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                No credit card needed <span className="text-[var(--foreground-subtle)]">(try it first)</span>.
              </p>
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
