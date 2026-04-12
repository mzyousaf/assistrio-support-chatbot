"use client";

import Link from "next/link";

import type { LaunchReadinessSidebarSnapshot } from "@/contexts/LaunchReadinessSidebarContext";
import type { EditorTabValue } from "@/lib/agent-slug-to-tab";
import { editorTabToSlug } from "@/lib/agent-slug-to-tab";

function tabHref(base: string, botId: string, tab: EditorTabValue): string {
  return `${base}/${botId}/${editorTabToSlug(tab)}`;
}

type Props = {
  data: LaunchReadinessSidebarSnapshot;
  theme: "light" | "dark";
};

export function LaunchReadinessSidebarCard({ data, theme }: Props) {
  const { status, model, botBasePath, botId } = data;
  const { required, recommended, requiredDone, requiredTotal, requiredPct, recommendedDone, recommendedTotal } = model;

  const checklistHref = `${botBasePath}/${botId}/playground/publish#publish-readiness`;
  const publishHref = `${botBasePath}/${botId}/playground/publish`;

  const missingRequired = required.filter((r) => !r.ok);
  const missingRecommended = recommended.filter((r) => !r.ok);
  const requiredComplete = missingRequired.length === 0;

  const primaryMissingTab: EditorTabValue | undefined = missingRequired[0]?.tab ?? missingRecommended[0]?.tab;

  let secondaryLine = "";
  if (!requiredComplete) {
    secondaryLine =
      missingRequired.length === 1 && missingRequired[0]
        ? `Still needed: ${missingRequired[0].label}`
        : `${missingRequired.length} required steps remaining`;
  } else if (missingRecommended.length > 0) {
    secondaryLine =
      missingRecommended.length === 1 && missingRecommended[0]
        ? `Suggested next: ${missingRecommended[0].label}`
        : `${missingRecommended.length} recommended improvements`;
  } else {
    secondaryLine = "Nice — recommended setup looks strong.";
  }

  const continueHref =
    primaryMissingTab != null ? tabHref(botBasePath, botId, primaryMissingTab) : publishHref;

  const continueLabel = !requiredComplete
    ? "Continue setup"
    : missingRecommended.length > 0
      ? "Improve setup"
      : "Open Publish";

  const isDark = theme === "dark";

  return (
    <div
      role="region"
      aria-label="Launch readiness summary"
      className={
        isDark
          ? "w-full max-w-none rounded-xl bg-slate-900/90 p-3.5 shadow-sm ring-1 ring-white/[0.06]"
          : "w-full max-w-none rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-900/[0.05]"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            Launch readiness
          </p>
          <h3 className="mt-1.5 text-base font-semibold leading-snug tracking-tight text-slate-900 dark:text-white">
            {requiredComplete ? "Ready to refine" : "Finish required setup"}
          </h3>
        </div>
        <span
          className={
            status === "published"
              ? "shrink-0 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
              : "shrink-0 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200/95"
          }
        >
          {status === "published" ? "Live" : "Draft"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{secondaryLine}</p>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Required checklist</span>
          <span className="text-sm tabular-nums font-semibold text-slate-800 dark:text-slate-100">
            {requiredDone}/{requiredTotal}
            <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">complete</span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-300 dark:bg-brand-400"
            style={{ width: `${requiredPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
          Recommended {recommendedDone}/{recommendedTotal}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        <Link
          href={checklistHref}
          className="inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          View checklist
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={publishHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-800 transition-colors hover:border-teal-200 hover:bg-teal-50/80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Open Publish
          </Link>
          <Link
            href={continueHref}
            className="inline-flex items-center justify-center rounded-xl bg-teal-50 px-3 py-2 text-center text-xs font-semibold text-brand-800 transition-colors hover:bg-teal-100/90 dark:bg-brand-500/15 dark:text-brand-100 dark:hover:bg-brand-500/25"
          >
            {continueLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
