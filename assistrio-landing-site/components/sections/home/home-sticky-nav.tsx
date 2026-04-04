"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Container } from "@/components/layout/container";

const NAV_LINKS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "widget", label: "Widget" },
  { id: "how-it-works", label: "How it works" },
  { id: "features", label: "Features" },
  { id: "use-cases", label: "Use cases" },
  { id: "live-demos", label: "Demos" },
  { id: "trust", label: "Trust" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
] as const;

/**
 * Minimal in-page anchor nav for the marketing homepage — sticky below the site header.
 * Active section is derived from scroll position (no heavy deps).
 */
export function HomeStickyNav() {
  const navRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string | null>(null);

  const updateActive = useCallback(() => {
    const header = document.querySelector("header");
    const headerH = header?.getBoundingClientRect().height ?? 64;
    const subnavH = navRef.current?.offsetHeight ?? 44;
    const line = headerH + subnavH + 6;

    let current: string | null = null;
    for (const { id } of NAV_LINKS) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= line) current = id;
    }
    setActive(current);
  }, []);

  useEffect(() => {
    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [updateActive]);

  return (
    <nav
      ref={navRef}
      aria-label="On this page"
      className="sticky top-14 z-30 border-b border-[var(--border-default)] bg-white/90 shadow-[var(--shadow-xs)] backdrop-blur-md supports-[backdrop-filter]:bg-white/80 sm:top-16"
    >
      <Container>
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:justify-center sm:overflow-visible sm:px-0 sm:py-3 [&::-webkit-scrollbar]:hidden">
          {NAV_LINKS.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 sm:text-[0.8125rem] ${
                  isActive
                    ? "bg-[var(--brand-teal-subtle)] text-[var(--brand-teal-dark)] ring-1 ring-[var(--border-teal-soft)]"
                    : "text-[var(--foreground-muted)] hover:bg-slate-100/90 hover:text-slate-800"
                }`}
              >
                {label}
              </a>
            );
          })}
        </div>
      </Container>
    </nav>
  );
}
