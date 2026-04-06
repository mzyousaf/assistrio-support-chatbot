"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { HomeSectionHeader } from "@/components/sections/home/home-section-header";
import { useCarouselAutoplay } from "@/hooks/useCarouselAutoplay";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const ease = [0.22, 1, 0.36, 1] as const;

const industries = [
  {
    title: "SaaS",
    category: "Software & PLG",
    useCases: "Onboarding · In-product support · Trial conversion",
    outcome: "Answer product questions without pulling engineers into every thread.",
  },
  {
    title: "Agencies",
    category: "Client delivery",
    useCases: "White-label polish · QA · Handoffs",
    outcome: "Ship consistent chat UX across every property you manage.",
  },
  {
    title: "Ecommerce",
    category: "Commerce",
    useCases: "Orders · Returns · Product Q&A",
    outcome: "Resolve pre-purchase friction while carts are still warm.",
  },
  {
    title: "Clinics",
    category: "Care operations",
    useCases: "Scheduling · Patient education · Routing",
    outcome: "Guide people to the right next step with calm, clear language.",
  },
  {
    title: "Legal firms",
    category: "Professional services",
    useCases: "Intake · Services · Escalation",
    outcome: "Collect structured context before an attorney joins the conversation.",
  },
  {
    title: "Real estate",
    category: "Property & tours",
    useCases: "Listings · Showings · Qualification",
    outcome: "Pre-qualify serious buyers and renters earlier in the funnel.",
  },
  {
    title: "Finance",
    category: "Regulated",
    useCases: "Policy guidance · Secure flows · Consistent answers",
    outcome: "Keep guidance aligned without improvising from scattered docs.",
  },
  {
    title: "Education",
    category: "Programs",
    useCases: "Deadlines · Programs · Family comms",
    outcome: "Handle repeat questions so staff stays focused on students.",
  },
  {
    title: "Support teams",
    category: "Operations",
    useCases: "Deflection · Consistency · Visibility",
    outcome: "Give every rep the same grounded answers visitors see on-site.",
  },
  {
    title: "Service businesses",
    category: "Local services",
    useCases: "Bookings · SLAs · Expertise",
    outcome: "Capture demand when your team is on-site, not at the desk.",
  },
] as const;

export function HomeIndustryCarousel() {
  const reduced = usePrefersReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  /** Logical slide for prev/next/autoplay — synced from scroll (with edge rules), not only React state. */
  const logicalIndexRef = useRef(0);

  const scrollToIndex = useCallback(
    (i: number) => {
      const root = scrollerRef.current;
      if (!root) return;
      const idx = Math.min(industries.length - 1, Math.max(0, i));
      const prev = logicalIndexRef.current;
      logicalIndexRef.current = idx;
      const card = root.querySelector<HTMLElement>(`[data-industry-card="${idx}"]`);
      if (!card) {
        logicalIndexRef.current = prev;
        return;
      }
      // scrollIntoView also scrolls the window; keep motion inside this scroller only (autoplay, dots, keys).
      const center = card.offsetLeft + card.offsetWidth / 2 - root.clientWidth / 2;
      const max = Math.max(0, root.scrollWidth - root.clientWidth);
      const left = Math.max(0, Math.min(center, max));
      // Long smooth travel (e.g. last → first) can feel stuck in some engines; instant is reliable for wrap jumps.
      const n = industries.length;
      const wrapJump =
        (prev === n - 1 && idx === 0) || (prev === 0 && idx === n - 1);
      root.scrollTo({
        left,
        behavior: reduced || wrapJump ? "auto" : "smooth",
      });
    },
    [reduced],
  );

  const scrollByDir = useCallback(
    (dir: -1 | 1) => {
      const n = industries.length;
      const cur = logicalIndexRef.current;
      const next = (cur + dir + n) % n;
      scrollToIndex(next);
    },
    [scrollToIndex],
  );

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const cards = () => Array.from(root.querySelectorAll<HTMLElement>("[data-industry-card]"));

    const onScroll = () => {
      const n = industries.length;
      const maxScroll = Math.max(0, root.scrollWidth - root.clientWidth);
      const x = root.scrollLeft;
      let best: number;

      // Variable card widths break “nearest center” at the strip ends — pin to first/last when scrolled flush.
      if (maxScroll <= 0) {
        best = 0;
      } else if (x >= maxScroll - 4) {
        best = n - 1;
      } else if (x <= 4) {
        best = 0;
      } else {
        const r = root.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        best = 0;
        let bestDist = Infinity;
        cards().forEach((el, i) => {
          const b = el.getBoundingClientRect();
          const c = b.left + b.width / 2;
          const d = Math.abs(c - mid);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
      }

      logicalIndexRef.current = best;
      setActive(best);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") scrollByDir(-1);
      if (e.key === "ArrowRight") scrollByDir(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollByDir]);

  const { pauseProps } = useCarouselAutoplay({
    disabled: reduced,
    intervalMs: 3200,
    onAdvance: () => {
      const n = industries.length;
      const next = (logicalIndexRef.current + 1) % n;
      scrollToIndex(next);
    },
  });

  const touchRef = useRef(0);

  return (
    <Section
      id="industries"
      fillViewport
      spacing="loose"
      className="border-b border-[var(--border-default)] bg-[var(--background)]"
    >
      <Container className="relative">
        <HomeSectionHeader
          id="industries-heading"
          eyebrow="Industries"
          title="Built for every business"
          titleWide
          titleVariant="premium"
          align="split"
          lead="Same runtime and controls — you tune knowledge, tone, and governance for how your market buys and gets help."
        >
          <p>
            <strong className="text-emphasis-primary">AI Support Agents</strong> that work 24/7 and never sleep—always on when someone reaches out—grounded in your
            knowledge and how you sound across SaaS, regulated services, commerce, and frontline support, without a separate product SKU per vertical.
          </p>
        </HomeSectionHeader>

        <div className="relative mt-14 lg:mt-16" {...pauseProps}>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/85 to-transparent sm:w-24"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[var(--background)] via-[var(--background)]/85 to-transparent sm:w-24"
            aria-hidden
          />

          <div
            ref={scrollerRef}
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:gap-5 sm:px-8 [&::-webkit-scrollbar]:hidden"
            onTouchStart={(e) => {
              touchRef.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const d = e.changedTouches[0].clientX - touchRef.current;
              if (d < -42) scrollByDir(1);
              if (d > 42) scrollByDir(-1);
            }}
          >
            {industries.map((ind, i) => (
              <motion.article
                key={ind.title}
                data-industry-card={i}
                initial={false}
                whileHover={reduced ? undefined : { y: -5, transition: { duration: 0.32, ease } }}
                className={`snap-center shrink-0 rounded-2xl border p-6 backdrop-blur-[2px] transition-[box-shadow,border-color,transform,opacity] duration-300 sm:p-7 ${i === active
                    ? "w-[min(100vw-3.5rem,21rem)] border-[color-mix(in_srgb,var(--brand-teal)_25%,var(--border-default))] bg-[color-mix(in_srgb,white_88%,var(--brand-teal-subtle)_12%)] shadow-[0_20px_56px_-32px_rgba(15,23,42,0.1),0_0_0_1px_rgba(13,148,136,0.08)] sm:w-[24rem]"
                    : "w-[min(100vw-4.5rem,18.25rem)] border-[var(--border-default)] bg-[color-mix(in_srgb,white_50%,var(--background)_50%)] opacity-[0.88] shadow-none sm:w-[19.5rem]"
                  }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-block max-w-[85%] truncate rounded-lg px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] ${i === active ? "bg-[var(--brand-teal-subtle)] text-[var(--brand-teal-dark)]" : "bg-slate-100 text-slate-500"
                      }`}
                    title={ind.category}
                  >
                    {ind.category}
                  </span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Use case</span>
                </div>
                <h3 className="text-carousel-slide-title mt-4 text-pretty">{ind.title}</h3>
                <p className="mt-3 text-[0.8125rem] font-semibold leading-snug tracking-tight text-slate-700">{ind.useCases}</p>
                <p className="text-meta mt-4 border-t border-[var(--border-default)] pt-4 leading-relaxed text-[var(--foreground-muted)]">{ind.outcome}</p>
              </motion.article>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-2 sm:mt-8">
            {industries.map((ind, i) => (
              <motion.button
                key={ind.title}
                type="button"
                aria-label={`${ind.title}: ${ind.useCases}`}
                aria-current={i === active}
                whileHover={reduced ? undefined : { scale: 1.05 }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                onClick={() => scrollToIndex(i)}
                className="flex h-11 min-w-[2.5rem] items-center justify-center rounded-full px-1 touch-manipulation"
              >
                <span
                  className={`block h-2 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${i === active ? "w-8 bg-[var(--brand-teal)] shadow-[0_0_16px_rgba(13,148,136,0.35)]" : "w-2 bg-slate-300 hover:bg-slate-400"
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
