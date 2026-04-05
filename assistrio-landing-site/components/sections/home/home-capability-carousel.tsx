"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { useCarouselAutoplay } from "@/hooks/useCarouselAutoplay";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const ease = [0.22, 1, 0.36, 1] as const;

const slide1Tags = [
  "Primary colors",
  "Launcher position",
  "Launcher icon",
  "Launcher size",
  "Bubble radius",
  "Panel borders",
  "Welcome message",
  "Footer branding",
  "Privacy text",
  "Animations",
  "Widget appearance",
  "Sender name",
  "Live status",
  "Branding line",
];

const slide2Tags = [
  "Documents",
  "FAQs",
  "Notes",
  "Plain descriptions",
  "URLs",
  "Contact roles",
  "Company teams",
  "Support responsibilities",
];

const slide3Tags = [
  "Smart lead forms",
  "Field capture",
  "Qualified leads",
  "Summaries",
  "Lead tracking",
  "Lead analytics",
  "Follow-up readiness",
];

const slide4Tags = [
  "Charts",
  "Topics",
  "Sentiment",
  "Conversation purpose",
  "Lead trends",
  "Engagement signals",
  "Support insights",
  "Performance metrics",
];

const bars = [72, 48, 88, 56, 100, 64, 80, 44, 92, 60];

function TagPill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--brand-teal)_15%,var(--border-default))] bg-gradient-to-b from-white to-slate-50/90 px-3.5 py-1.5 text-[0.75rem] font-medium text-slate-700 shadow-[var(--shadow-xs)] ring-1 ring-white/80 transition-shadow duration-200 hover:shadow-[var(--shadow-sm)]">
      <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--brand-teal)]" aria-hidden />
      {children}
    </span>
  );
}

function BrandingSlideVisual() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="absolute -inset-3 rounded-[1.75rem] bg-[radial-gradient(ellipse_at_50%_80%,rgba(13,148,136,0.15),transparent_65%)]" aria-hidden />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease }}
        className="relative overflow-hidden rounded-[1.35rem] border border-white/80 bg-gradient-to-b from-white via-slate-50/40 to-slate-100/30 shadow-[0_32px_80px_-28px_rgba(15,23,42,0.2),0_0_0_1px_rgba(13,148,136,0.06)] ring-1 ring-slate-900/[0.04]"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[var(--brand-teal)] to-teal-700 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-200" />
            </span>
            <span className="text-sm font-semibold">Acme · Support</span>
          </div>
          <span className="text-xs font-medium text-white/80">Live</span>
        </div>
        <div className="space-y-3 bg-slate-50/95 p-4">
          <p className="text-center text-[0.65rem] uppercase tracking-wider text-slate-400">Branding line · privacy below</p>
          <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3 py-2.5 text-sm leading-snug text-slate-700 shadow-sm">
            Welcome — I can answer from your docs and policies.
          </div>
          <div className="ml-8 rounded-2xl rounded-br-md border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)] px-3 py-2.5 text-sm text-slate-800">
            Do you offer annual billing?
          </div>
          <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm">
            Yes — here is how annual contracts work…
          </div>
        </div>
        <div className="border-t border-slate-100 bg-white px-3 py-2.5">
          <div className="h-10 rounded-full border border-slate-200 bg-slate-50 pl-4 text-xs leading-10 text-slate-400">Message with footer branding…</div>
          <p className="text-meta mt-2 text-center">Privacy and terms linked in footer</p>
        </div>
        <motion.div
          className="absolute -bottom-1 -right-1 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-teal)] text-white shadow-[0_12px_32px_rgba(13,148,136,0.45)] ring-4 ring-white"
          animate={reduced ? { scale: 1 } : { scale: [1, 1.04, 1] }}
          transition={reduced ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M4 4.5C4 3.12 5.12 2 6.5 2h11C18.88 2 20 3.12 20 4.5v9c0 1.38-1.12 2.5-2.5 2.5H9.25L5 21v-5H4.5A2.5 2.5 0 0 1 2 13.5v-9Zm2.5-.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H7v2.2l2.35-2.2H17.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11Z" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
}

function AnalyticsSlideVisual() {
  return (
    <div className="relative mx-auto max-w-md rounded-[1.35rem] border border-[var(--border-teal-soft)]/50 bg-gradient-to-b from-white via-slate-50/50 to-white p-6 shadow-[0_28px_70px_-24px_rgba(13,148,136,0.12),var(--shadow-premium)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_10%,transparent)]">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal-dark)]">Insights</p>
      <p className="text-meta mt-1">Illustrative layout</p>
      <div className="mt-5 flex h-36 items-end justify-between gap-1.5">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.45, delay: i * 0.04, ease }}
            className="min-w-0 flex-1 origin-bottom rounded-t-md bg-gradient-to-t from-[var(--brand-teal)]/85 to-[var(--brand-teal)]/30"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {["Topics", "Sentiment", "Purpose"].map((l) => (
          <div key={l} className="rounded-lg bg-[var(--surface-muted)]/70 py-2 text-[0.65rem] font-semibold text-slate-600">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

const slides = [
  {
    id: "branding",
    title: "Branding & Chat Experience",
    message: "Own every pixel visitors see in the thread — from launcher to footer.",
    tags: slide1Tags,
    visual: <BrandingSlideVisual />,
  },
  {
    id: "knowledge",
    title: "Knowledge Base",
    message: "Train your AI Support Agent with the exact knowledge your customers need.",
    tags: slide2Tags,
    visual: (
      <div className="mx-auto flex max-w-sm flex-col items-center justify-center rounded-[1.35rem] border border-[var(--border-teal-soft)] bg-gradient-to-br from-[var(--brand-teal-subtle)]/35 via-white to-white p-10 text-center shadow-[var(--shadow-md)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_12%,transparent)]">
        <div className="grid w-full grid-cols-2 gap-2.5 text-left text-[0.75rem] font-medium text-slate-700">
          {[
            { k: "Docs", c: "PDFs & guides" },
            { k: "FAQs", c: "Short answers" },
            { k: "Notes", c: "Internal truth" },
            { k: "URLs", c: "Live pages" },
          ].map((x) => (
            <span key={x.k} className="rounded-xl border border-[var(--border-default)] bg-white/95 px-3 py-2 shadow-[var(--shadow-xs)]">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--brand-teal-dark)]">{x.k}</span>
              <span className="text-meta mt-0.5 block font-normal">{x.c}</span>
            </span>
          ))}
        </div>
        <p className="text-meta mt-5 leading-relaxed">Contact roles, teams, and support responsibilities stay aligned with how you actually work.</p>
      </div>
    ),
  },
  {
    id: "leads",
    title: "Lead Capture & Conversion",
    message: "Turn conversations into real business opportunities.",
    tags: slide3Tags,
    visual: (
      <div className="mx-auto max-w-sm rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/60 p-7 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.04]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand-teal-dark)]">Qualified handoff</p>
        <p className="mt-2 text-sm font-medium text-slate-800">Enterprise pricing · ready for sales</p>
        <p className="text-meta mt-1">Summary + fields attached to the thread</p>
        <div className="mt-5 space-y-2.5 border-t border-[var(--border-default)] pt-5">
          {["Name", "Work email", "Buying intent"].map((f) => (
            <div key={f} className="flex h-10 items-center rounded-xl border border-slate-200/80 bg-white pl-3.5 text-xs font-medium text-slate-500 shadow-[var(--shadow-xs)]">
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "analytics",
    title: "Analytics & Insights",
    message: "Understand what customers ask, feel, and need.",
    tags: slide4Tags,
    visual: <AnalyticsSlideVisual />,
  },
];

export function HomeCapabilityCarousel() {
  const reduced = usePrefersReducedMotion();
  const innerDuration = reduced ? 0.18 : 0.55;
  const [page, setPage] = useState(0);
  const touchStart = useRef(0);
  const n = slides.length;

  const go = useCallback(
    (dir: -1 | 1) => {
      setPage((p) => Math.min(n - 1, Math.max(0, p + dir)));
    },
    [n],
  );

  const { pauseProps } = useCarouselAutoplay({
    disabled: reduced,
    intervalMs: 3200,
    onAdvance: () => setPage((p) => (p + 1) % n),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const slidePct = 100 / n;

  return (
    <Section
      id="capabilities"
      fillViewport
      spacing="loose"
      className="relative border-b border-[var(--border-default)] bg-[var(--background)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(ellipse_88%_100%_at_50%_0%,rgba(13,148,136,0.065),transparent_74%)]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent"
        aria-hidden
      />
      <Container className="relative">
        <HomeSectionHeader
          id="capabilities-heading"
          eyebrow="Control"
          title="Everything you control"
          titleWide
          titleVariant="premium"
          align="split"
          lead="Appearance, memory, pipeline, and analytics — each slide is a control plane your team actually touches in production."
        >
          <p>
            Customize every part of your <strong className="font-semibold text-slate-800">AI Support Agent</strong> experience — from branding and knowledge to lead capture and
            advanced insights — without duct-taping four vendors together.
          </p>
        </HomeSectionHeader>

        <p className="text-meta mx-auto mt-6 max-w-2xl text-center text-[var(--foreground-muted)] sm:mt-7">
          Governance stays practical: <strong className="font-semibold text-slate-700">Allowed websites</strong>,{" "}
          <strong className="font-semibold text-slate-700">workspace roles</strong>, and production runtime maintenance — without inventing uptime percentages.
        </p>

        <div className="relative mt-12 lg:mt-14" {...pauseProps}>
          <div className="relative">
            <div
              className="overflow-hidden rounded-2xl"
              onTouchStart={(e) => {
                touchStart.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                const x = e.changedTouches[0].clientX - touchStart.current;
                if (x < -40) go(1);
                if (x > 40) go(-1);
              }}
            >
              <motion.div
                className="flex"
                style={{ width: `${n * 100}%` }}
                animate={{ x: `-${page * slidePct}%` }}
                transition={
                  reduced
                    ? { duration: 0.22, ease }
                    : { type: "spring", stiffness: 155, damping: 30, mass: 0.72 }
                }
              >
                {slides.map((s, i) => (
                  <div
                    key={s.id}
                    className="shrink-0 px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-12"
                    style={{ width: `${slidePct}%` }}
                  >
                    <motion.div
                      className={`mx-auto max-w-6xl rounded-2xl border p-6 backdrop-blur-[2px] sm:p-8 md:p-10 max-sm:p-5 ${i === page
                          ? "border-[color-mix(in_srgb,var(--brand-teal)_22%,var(--border-default))] bg-[color-mix(in_srgb,white_82%,var(--brand-teal-subtle)_18%)] shadow-[0_24px_64px_-36px_rgba(15,23,42,0.12),0_0_0_1px_rgba(13,148,136,0.08)]"
                          : "border-[var(--border-default)] bg-[color-mix(in_srgb,white_55%,var(--background)_45%)] shadow-none"
                        }`}
                      animate={i === page ? { scale: 1, opacity: 1 } : { scale: reduced ? 1 : 0.995, opacity: reduced ? 1 : 0.78 }}
                      transition={{ duration: innerDuration, ease }}
                    >
                      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12">
                        <div>
                          <h3 className="text-carousel-slide-title text-pretty">{s.title}</h3>
                          <p className="text-carousel-slide-sub mt-4">{s.message}</p>
                          <div className="mt-8 flex flex-wrap gap-2">
                            {s.tags.map((t) => (
                              <TagPill key={t}>{t}</TagPill>
                            ))}
                          </div>
                        </div>
                        <div className="flex min-h-[16rem] items-center justify-center lg:min-h-[20rem]">{s.visual}</div>
                      </div>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2 sm:mt-9 sm:gap-2.5">
            {slides.map((s, i) => (
              <motion.button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}: ${s.title}`}
                aria-current={i === page}
                whileHover={reduced ? undefined : { scale: 1.04 }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                onClick={() => setPage(i)}
                className="flex h-11 min-w-[2.75rem] items-center justify-center rounded-full px-1 touch-manipulation"
              >
                <span
                  className={`block h-2.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${i === page
                      ? "w-10 bg-[var(--brand-teal)] shadow-[0_0_20px_rgba(13,148,136,0.38)]"
                      : "w-2.5 bg-slate-300/90 hover:bg-slate-400"
                    }`}
                />
              </motion.button>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
