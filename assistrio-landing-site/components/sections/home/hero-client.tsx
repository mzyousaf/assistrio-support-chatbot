"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { HeroPrimaryCtas } from "@/components/sections/home/hero-primary-ctas";
import { HeroProductVisual } from "@/components/sections/home/hero-product-visual";

const ease = [0.22, 1, 0.36, 1] as const;

function HeroTrustChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-teal-soft)]/80 bg-white/80 px-2 py-1 text-[0.6875rem] font-medium text-slate-600 shadow-[var(--shadow-xs)] backdrop-blur-sm sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[0.75rem]">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal-subtle)]/90 text-[var(--brand-teal-dark)] sm:h-5 sm:w-5" aria-hidden>
        {icon}
      </span>
      {label}
    </span>
  );
}

export function HeroClient() {
  return (
    <Container className="relative">
      <div className="grid min-w-0 items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 xl:gap-24">
        <div className="relative z-[1] min-w-0 max-w-2xl lg:max-w-none">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.02 }}
            className="flex flex-wrap items-center gap-2.5"
          >
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/75 px-3 py-1.5 text-[0.7rem] font-semibold leading-snug tracking-wide text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)] sm:px-3.5 sm:py-1 sm:text-xs">
              <svg
                className="h-3.5 w-3.5 shrink-0 opacity-90"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              Assistrio Provides
            </span>
            <span className="text-[0.8125rem] font-medium text-slate-500">Branded AI Support Agents on websites you allow</span>
          </motion.div>

          <motion.h1
            className="mt-6 max-w-[min(100%,42rem)] text-pretty sm:mt-7"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease, delay: 0.06 }}
          >
            <span className="text-hero-display block">Your AI Support Agent</span>
            <span className="hero-display-kicker mt-3 block max-w-[40rem] sm:mt-3.5">Always on · 24/7</span>
          </motion.h1>

          <motion.p
            className="text-hero-subhead mt-5 max-w-2xl text-pretty sm:mt-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease, delay: 0.1 }}
          >
            Customers get answers around the clock — even when you step away.{" "}
            <strong className="text-emphasis-primary">Your brand, your control on the websites you allow.</strong>{" "}
            Launch <strong className="text-emphasis-primary">fully customizable</strong> AI Support grounded in your
            knowledge base, with lead capture, branding, and analytics — in one product.
          </motion.p>

          <motion.div
            className="mt-6 flex flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-visible pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-7 sm:gap-2.5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.14 }}
          >
            <HeroTrustChip
              label="24/7 coverage"
              icon={
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" strokeLinecap="round" />
                  <path d="M2 12h20" strokeLinecap="round" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" strokeLinecap="round" />
                </svg>
              }
            />
            <HeroTrustChip
              label="Your brand & knowledge"
              icon={
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" strokeLinejoin="round" />
                  <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinecap="round" />
                </svg>
              }
            />
            <HeroTrustChip
              label="Your AI Support Agent"
              icon={
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 21Z" />
                </svg>
              }
            />
          </motion.div>

          <motion.div
            className="mt-8 sm:mt-10"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.18 }}
          >
            <HeroPrimaryCtas />
          </motion.div>
        </div>

        <motion.aside
          className="relative mx-auto w-full min-w-0 max-w-md lg:mx-0 lg:max-w-none"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease, delay: 0.1 }}
        >
          <div
            className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(ellipse_65%_55%_at_50%_42%,rgba(13,148,136,0.14),transparent_68%)] sm:-inset-8"
            aria-hidden
          />
          <div className="relative rounded-[1.75rem] border border-[var(--border-teal-soft)]/40 bg-gradient-to-br from-white/60 via-white/20 to-[var(--brand-teal-subtle)]/25 p-1 shadow-[0_32px_80px_-40px_rgba(13,148,136,0.35)] ring-1 ring-slate-900/[0.04] backdrop-blur-[2px] sm:p-1.5">
            <HeroProductVisual />
          </div>
        </motion.aside>
      </div>
    </Container>
  );
}
