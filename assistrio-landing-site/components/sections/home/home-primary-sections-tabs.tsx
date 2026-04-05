"use client";

import { Children, type ReactNode, useCallback, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Section } from "@/components/layout/section";
import { HomeSectionGlowBackdrop } from "@/components/sections/home/home-section-glow-backdrop";
import { useCarouselAutoplay } from "@/hooks/useCarouselAutoplay";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const ease = [0.22, 1, 0.36, 1] as const;

export type HomePrimarySectionsTabLabels = readonly [string, string, string];

type Props = {
  children: ReactNode;
  tabLabels: HomePrimarySectionsTabLabels;
};

/**
 * Three homepage bands with stacked panels (stable height), cross-fade transitions, dot nav, and autoplay.
 */
export function HomePrimarySectionsTabs({ children, tabLabels }: Props) {
  const slides = Children.toArray(children);
  const n = slides.length;
  const [active, setActiveState] = useState(0);
  const baseId = useId().replace(/:/g, "");
  const reduced = usePrefersReducedMotion();
  const transitionDirRef = useRef<1 | -1>(1);

  const setSlide = useCallback(
    (next: number) => {
      setActiveState((prev) => {
        if (next === prev) return prev;
        const forward = (next - prev + n) % n;
        const backward = (prev - next + n) % n;
        transitionDirRef.current = forward <= backward ? 1 : -1;
        return next;
      });
    },
    [n],
  );

  useCarouselAutoplay({
    disabled: reduced,
    intervalMs: 3200,
    onAdvance: () => {
      setActiveState((prev) => {
        const next = (prev + 1) % n;
        const forward = (next - prev + n) % n;
        const backward = (prev - next + n) % n;
        transitionDirRef.current = forward <= backward ? 1 : -1;
        return next;
      });
    },
    /** false = keep advancing while user reads this section (matches other home carousels). */
    pauseOnInteraction: false,
  });

  const safeIndex = Math.min(active, Math.max(0, n - 1));
  const panelId = `primary-tab-panel-${baseId}`;
  const dir = transitionDirRef.current;
  const tDuration = reduced ? 0 : 0.42;

  return (
    <Section
      id="home-primary-sections"
      spacing="loose"
      className="relative overflow-hidden border-b border-[var(--border-default)]"
    >
      <HomeSectionGlowBackdrop />

      <div className="relative z-10">
        <p className="sr-only" aria-live="polite">
          {tabLabels[safeIndex]}
        </p>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`primary-tab-${baseId}-${safeIndex}`}
          className="min-h-0"
        >
          <div className="grid w-full grid-cols-1 overflow-x-hidden">
            {slides.map((slide, i) => {
              const isOn = i === safeIndex;
              const exitX = i < safeIndex ? -36 * dir : 36 * dir;
              return (
                <motion.div
                  key={i}
                  className="col-start-1 row-start-1 min-w-0"
                  initial={false}
                  animate={
                    isOn
                      ? { opacity: 1, x: 0, filter: "blur(0px)" }
                      : { opacity: 0, x: exitX, filter: reduced ? "blur(0px)" : "blur(2px)" }
                  }
                  transition={{ duration: tDuration, ease }}
                  style={{ zIndex: isOn ? 1 : 0, pointerEvents: isOn ? "auto" : "none" }}
                  aria-hidden={!isOn}
                  inert={!isOn ? true : undefined}
                >
                  {slide}
                </motion.div>
              );
            })}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Key product areas"
          className="flex shrink-0 flex-wrap justify-center gap-2 pt-8 sm:gap-3 sm:pt-10"
        >
          {tabLabels.map((label, i) => {
            const isCurrent = i === safeIndex;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                id={`primary-tab-${baseId}-${i}`}
                aria-selected={isCurrent}
                aria-controls={panelId}
                tabIndex={isCurrent ? 0 : -1}
                aria-label={`Show section: ${label}`}
                onClick={() => setSlide(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = (i + 1) % n;
                    setSlide(next);
                    document.getElementById(`primary-tab-${baseId}-${next}`)?.focus();
                  }
                  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const prev = (i - 1 + n) % n;
                    setSlide(prev);
                    document.getElementById(`primary-tab-${baseId}-${prev}`)?.focus();
                  }
                  if (e.key === "Home") {
                    e.preventDefault();
                    setSlide(0);
                    document.getElementById(`primary-tab-${baseId}-0`)?.focus();
                  }
                  if (e.key === "End") {
                    e.preventDefault();
                    const last = n - 1;
                    setSlide(last);
                    document.getElementById(`primary-tab-${baseId}-${last}`)?.focus();
                  }
                }}
                className="flex h-11 min-w-[2.75rem] items-center justify-center rounded-full px-1 touch-manipulation"
              >
                <span
                  className={`block h-2.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isCurrent
                      ? "w-10 bg-[var(--brand-teal)] shadow-[0_0_20px_rgba(13,148,136,0.38)]"
                      : "w-2.5 bg-slate-300/90 hover:bg-slate-400"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
