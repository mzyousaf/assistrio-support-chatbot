"use client";

import { motion } from "framer-motion";
import { ProductChromeApp, productFrameShellClassName } from "@/components/product/product-visual-frame";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 pl-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand-teal)]"
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

/** Compact workspace + visitor widget — calmer layout, fewer heavy boxes */
export function HeroProductVisual() {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,26rem)] lg:max-w-none">
      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reduced ? undefined : { y: [0, -3, 0] }}
          transition={reduced ? undefined : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className={`${productFrameShellClassName} shadow-[0_24px_70px_-32px_rgba(15,23,42,0.12),0_0_0_1px_rgba(13,148,136,0.08)] ring-1 ring-slate-900/[0.03]`}
        >
          <ProductChromeApp addressBarLabel="app.assistrio.com · Acme · Launch workspace" />
          <div className="grid gap-0 bg-gradient-to-br from-white via-slate-50/40 to-[var(--brand-teal-subtle)]/12 lg:grid-cols-[5.5rem_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--border-default)]/80 bg-white/95 p-2 lg:block">
              <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Nav</p>
              <ul className="mt-2 space-y-1 text-[0.68rem] text-slate-600">
                <li className="rounded-lg bg-[var(--brand-teal-subtle)] px-2 py-1.5 font-semibold text-[var(--brand-teal-dark)]">Agent</li>
                <li className="rounded-lg px-2 py-1 text-slate-500">Knowledge</li>
                <li className="rounded-lg px-2 py-1 text-slate-500">Insights</li>
              </ul>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-slate-400">Published agent</p>
                  <p className="mt-1.5 font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-slate-900 sm:text-xl">Customer support</p>
                  <p className="mt-1 text-[0.72rem] text-[var(--foreground-muted)]">Live on your websites</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--brand-teal)] px-3 py-1 text-[0.65rem] font-semibold tracking-wide text-white shadow-sm">Live</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { label: "Runtime", value: "Managed" },
                  { label: "Brand", value: "Yours" },
                  { label: "Sites", value: "Yours" },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="inline-flex items-baseline gap-2 rounded-full border border-[var(--border-default)]/90 bg-white/90 px-3 py-1.5 shadow-[var(--shadow-xs)]"
                  >
                    <span className="text-[0.58rem] font-medium uppercase tracking-wide text-slate-400">{m.label}</span>
                    <span className="font-[family-name:var(--font-display)] text-[0.8rem] font-semibold text-slate-800">{m.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-[var(--border-teal-soft)]/90 bg-[var(--brand-teal-subtle)]/20 px-3 py-2.5">
                <p className="text-[0.58rem] font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">Visitor embed</p>
                <p className="mt-1 text-[0.72rem] text-slate-600">
                  Widget on <span className="font-medium text-slate-800">www.yourbusiness.com</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute -bottom-2 -right-1 z-10 w-[min(100%,17rem)] sm:-bottom-3 sm:-right-2 sm:w-[18rem]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          <motion.div
            animate={reduced ? undefined : { y: [0, -4, 0] }}
            transition={reduced ? undefined : { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_22px_56px_-20px_rgba(15,23,42,0.22)] backdrop-blur-sm"
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-[var(--brand-teal)] to-[var(--brand-teal-hover)] px-3.5 py-2.5 text-white">
              <span className="text-[0.82rem] font-semibold tracking-tight">Your brand</span>
              <span className="text-lg leading-none opacity-90" aria-hidden>
                ×
              </span>
            </div>
            <div className="space-y-2.5 bg-gradient-to-b from-slate-50/90 to-white px-3.5 py-3">
              <div className="rounded-2xl rounded-bl-md border border-slate-100/90 bg-white px-3 py-2.5 text-[0.8rem] leading-snug text-slate-700 shadow-sm">
                Hi — ask me anything about plans, billing, or setup.
              </div>
              <div className="ml-3 rounded-2xl rounded-br-md border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/80 px-3 py-2.5 text-[0.8rem] text-slate-800">
                Do you offer annual contracts?
              </div>
              <p className="flex items-center pl-1 text-[0.66rem] font-medium text-slate-400">
                Assistant is replying
                <TypingDots />
              </p>
            </div>
            <div className="border-t border-slate-100 bg-white px-3 py-2.5">
              <div className="h-9 rounded-full border border-slate-200/80 bg-slate-50/90 pl-3.5 text-[0.7rem] leading-9 text-slate-400">Message…</div>
            </div>
          </motion.div>

          <motion.span
            className="pointer-events-none absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-teal)] text-white shadow-[0_10px_28px_rgba(13,148,136,0.42)] ring-[3px] ring-white"
            aria-hidden
            animate={reduced ? { scale: 1 } : { scale: [1, 1.04, 1] }}
            transition={reduced ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M4 4.5C4 3.12 5.12 2 6.5 2h11C18.88 2 20 3.12 20 4.5v9c0 1.38-1.12 2.5-2.5 2.5H9.25L5 21v-5H4.5A2.5 2.5 0 0 1 2 13.5v-9Zm2.5-.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H7v2.2l2.35-2.2H17.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11Z" />
            </svg>
          </motion.span>
        </motion.div>
      </motion.div>
    </div>
  );
}
