"use client";

import { useCallback, useEffect, useState } from "react";

const SECTIONS = [
  { id: "publish-access", label: "Access" },
  { id: "publish-domains", label: "Domains" },
  { id: "publish-conversation-mode", label: "Conversation" },
  { id: "publish-keys", label: "Keys" },
  { id: "publish-status", label: "Status" },
  { id: "publish-readiness", label: "Readiness" },
  { id: "publish-snippet", label: "Embed" },
  { id: "publish-actions", label: "Actions" },
] as const;

function cx(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

export function PublishInPageNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  const refreshFromHash = useCallback(() => {
    const h = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (h && SECTIONS.some((s) => s.id === h)) setActive(h);
  }, []);

  useEffect(() => {
    refreshFromHash();
    window.addEventListener("hashchange", refreshFromHash);
    return () => window.removeEventListener("hashchange", refreshFromHash);
  }, [refreshFromHash]);

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el != null,
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.target.id)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { root: null, rootMargin: "-12% 0px -62% 0px", threshold: [0, 0.1, 0.25] },
    );

    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className="sticky top-0 z-[5] -mx-1 mb-8 border-b border-teal-200/25 bg-[#f4fbfb]/90 pb-3 pt-1 backdrop-blur-md dark:border-slate-700/40 dark:bg-gray-950/90"
      aria-label="Publish page sections"
    >
      <div
        className="flex flex-wrap gap-1 rounded-xl bg-white/70 p-1 shadow-sm ring-1 ring-slate-900/[0.04] dark:bg-slate-900/60 dark:ring-white/10"
        role="tablist"
      >
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              role="tab"
              aria-selected={isActive}
              className={cx(
                "inline-flex min-h-[2.25rem] items-center justify-center rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                isActive
                  ? "bg-brand-500 text-white shadow-sm shadow-teal-900/15 dark:bg-brand-600 dark:text-white"
                  : "text-slate-600 hover:bg-teal-50/90 hover:text-brand-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-200",
              )}
              onClick={() => setActive(s.id)}
            >
              {s.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
