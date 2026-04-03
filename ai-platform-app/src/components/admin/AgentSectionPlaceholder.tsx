"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

type AgentSectionPlaceholderProps = {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function AgentSectionPlaceholder({
  title,
  description,
  ctaHref,
  ctaLabel,
}: AgentSectionPlaceholderProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-teal-200/60 bg-gradient-to-br from-white via-teal-50/30 to-slate-50/90 p-8 shadow-sm ring-1 ring-teal-100/40 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900/90 dark:to-slate-950 dark:ring-slate-800/60">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-400/15 blur-3xl dark:bg-brand-500/10"
        aria-hidden
      />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-md border border-teal-200/60 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-800 shadow-sm dark:border-brand-500/25 dark:bg-slate-900/80 dark:text-brand-200">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Soon
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className="mt-6 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/10 ring-1 ring-teal-800/10 transition hover:bg-brand-700"
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
