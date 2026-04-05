"use client";

import { motion } from "framer-motion";
import { ProductFrameScreenshot } from "@/components/product/product-frame-screenshot";
import { ProductVisualFrame } from "@/components/product/product-visual-frame";
import { HomeDashboardMock } from "@/components/sections/home/home-dashboard-mock";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const dashboardScreenshot =
  typeof process.env.NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD === "string"
    ? process.env.NEXT_PUBLIC_HOME_SCREENSHOT_DASHBOARD.trim()
    : "";

const ease = [0.22, 1, 0.36, 1] as const;

const bars = [68, 44, 82, 52, 100, 58, 76, 48];

const floatCardClass =
  "rounded-2xl border border-[color-mix(in_srgb,var(--brand-teal)_12%,var(--border-default))] bg-white/95 p-3.5 shadow-[var(--shadow-md)] ring-1 ring-white/70 backdrop-blur-md transition-[box-shadow,transform,border-color] duration-300 hover:border-[color-mix(in_srgb,var(--brand-teal)_22%,var(--border-default))] hover:shadow-[var(--shadow-premium)] sm:p-4";

function MiniLabel({ children, accent }: { children: string; accent?: boolean }) {
  return (
    <p
      className={`text-[0.6rem] font-semibold uppercase tracking-[0.14em] ${accent ? "text-[var(--brand-teal-dark)]" : "text-[var(--foreground-subtle)]"}`}
    >
      {children}
    </p>
  );
}

function LeadCaptureMini() {
  return (
    <div className={floatCardClass}>
      <MiniLabel accent>New lead</MiniLabel>
      <p className="mt-2 text-[0.8rem] font-semibold text-slate-800">Enterprise pricing</p>
      <p className="text-meta mt-0.5">Summary attached to thread</p>
      <div className="mt-3 space-y-2">
        <div className="h-8 rounded-lg border border-slate-200/90 bg-slate-50/90 pl-2.5 text-[0.7rem] leading-8 text-slate-500">Work email</div>
        <div className="h-8 rounded-lg border border-slate-200/90 bg-slate-50/90 pl-2.5 text-[0.7rem] leading-8 text-slate-500">Buying intent</div>
      </div>
    </div>
  );
}

function WidgetMini() {
  return (
    <div className={floatCardClass}>
      <MiniLabel accent>Widget preview</MiniLabel>
      <div className="mt-2.5 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
        <div className="flex items-center justify-between bg-[var(--brand-teal)] px-2.5 py-1.5 text-[0.65rem] font-semibold text-white">
          <span>Your brand</span>
          <span className="opacity-75" aria-hidden>
            ●
          </span>
        </div>
        <div className="space-y-1.5 p-2.5">
          <div className="rounded-lg rounded-bl-sm bg-slate-100 px-2 py-1 text-[0.65rem] text-slate-700">How can we help?</div>
          <div className="ml-3 rounded-lg rounded-br-sm bg-[var(--brand-teal-subtle)] px-2 py-1 text-[0.65rem] text-slate-800">Quick question…</div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsMini() {
  return (
    <div className={`${floatCardClass} bg-gradient-to-br from-white to-[var(--brand-teal-subtle)]/25`}>
      <MiniLabel accent>Analytics</MiniLabel>
      <div className="mt-2 flex h-20 items-end justify-between gap-0.5">
        {bars.slice(0, 6).map((h, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 origin-bottom rounded-t-sm bg-gradient-to-t from-[var(--brand-teal)]/85 to-[var(--brand-teal)]/28"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <p className="text-meta mt-2 text-center">Topics · sentiment · purpose</p>
    </div>
  );
}

function BrandingMini() {
  return (
    <div className={floatCardClass}>
      <MiniLabel>Brand system</MiniLabel>
      <div className="mt-2.5 flex gap-1.5">
        {["#0d9488", "#115e59", "#0f172a"].map((c) => (
          <span key={c} className="h-8 w-8 rounded-full border border-white shadow-md ring-2 ring-slate-200/80" style={{ backgroundColor: c }} aria-hidden />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <span className="rounded-md border border-[var(--border-default)] bg-slate-50 px-1.5 py-0.5 text-[0.6rem] font-medium text-slate-600">Light</span>
        <span className="rounded-md border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[var(--brand-teal-dark)]">
          Dark
        </span>
      </div>
      <p className="text-meta mt-2">Launcher · radius</p>
    </div>
  );
}

export function ProductExperienceVisuals() {
  const reduced = usePrefersReducedMotion();
  const hoverY = reduced ? 0 : -4;

  return (
    <div className="relative mx-auto max-w-[min(100%,40rem)] lg:max-w-none">
      <div
        className="pointer-events-none absolute -inset-4 rounded-[2.25rem] bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(13,148,136,0.12),transparent_68%)] sm:-inset-6"
        aria-hidden
      />

      <div className="relative overflow-visible rounded-[1.75rem] border border-[color-mix(in_srgb,var(--brand-teal)_10%,var(--border-default))] bg-gradient-to-br from-white/95 via-slate-50/35 to-[var(--brand-teal-subtle)]/22 p-4 shadow-[0_32px_90px_-36px_rgba(15,23,42,0.16),var(--shadow-premium)] ring-1 ring-white/80 backdrop-blur-[3px] sm:rounded-[2rem] sm:p-5 lg:p-6">
        <div
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[linear-gradient(145deg,rgba(255,255,255,0.55)_0%,transparent_42%,rgba(13,148,136,0.05)_100%)] sm:rounded-[2rem]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-6 bottom-0 h-24 rounded-full bg-[radial-gradient(ellipse_80%_100%_at_50%_100%,rgba(13,148,136,0.08),transparent_70%)] blur-xl"
          aria-hidden
        />

        {/* Desktop: floating satellites */}
        <motion.div
          initial={false}
          whileHover={reduced ? undefined : { y: hoverY }}
          transition={{ duration: 0.35, ease }}
          className="absolute -left-2 top-[16%] z-20 hidden w-[10.75rem] -rotate-[2deg] lg:block xl:-left-4 xl:w-[11.5rem]"
        >
          <LeadCaptureMini />
        </motion.div>
        <motion.div
          initial={false}
          whileHover={reduced ? undefined : { y: hoverY }}
          transition={{ duration: 0.35, ease }}
          className="absolute -right-1 top-[10%] z-20 hidden w-[9.5rem] rotate-[2.5deg] lg:block xl:-right-2 xl:w-[10.25rem]"
        >
          <WidgetMini />
        </motion.div>
        <motion.div
          initial={false}
          whileHover={reduced ? undefined : { y: hoverY }}
          transition={{ duration: 0.35, ease }}
          className="absolute -right-3 bottom-[20%] z-20 hidden w-[10.5rem] rotate-[1.5deg] lg:block xl:w-[11rem]"
        >
          <AnalyticsMini />
        </motion.div>
        <motion.div
          initial={false}
          whileHover={reduced ? undefined : { y: hoverY }}
          transition={{ duration: 0.35, ease }}
          className="absolute -left-1 bottom-[12%] z-20 hidden w-[10.25rem] -rotate-[1deg] lg:block xl:-left-3 xl:w-[10.75rem]"
        >
          <BrandingMini />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: reduced ? 0.2 : 0.62, ease }}
          className="relative z-10 lg:mx-auto lg:max-w-[min(100%,36rem)] xl:max-w-[min(100%,38rem)]"
        >
          <ProductVisualFrame
            addressBarLabel="app.assistrio.com · Workspace · AI Support Agent"
            className="shadow-[0_28px_70px_-28px_rgba(15,23,42,0.18),0_0_0_1px_rgba(13,148,136,0.07)] ring-1 ring-[var(--border-default)]"
          >
            <ProductFrameScreenshot
              src={dashboardScreenshot || undefined}
              alt="Assistrio workspace for managing and deploying an AI Support Agent"
              priority={false}
            >
              <HomeDashboardMock />
            </ProductFrameScreenshot>
          </ProductVisualFrame>
          <p className="text-meta mt-3 text-center">
            {dashboardScreenshot ? "Product UI — illustrative data." : "Illustrative workspace — not live data."}
          </p>
        </motion.div>

        {/* Mobile / tablet: same stories in a tight grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:hidden">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease, delay: 0.04 }}
          >
            <LeadCaptureMini />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease, delay: 0.08 }}
          >
            <WidgetMini />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease, delay: 0.12 }}
          >
            <AnalyticsMini />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease, delay: 0.16 }}
          >
            <BrandingMini />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
