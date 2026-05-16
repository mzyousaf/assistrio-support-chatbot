"use client";

import React from "react";
import Link from "next/link";

export interface BotEditorPaneProps {
  /** Current editor section (matches sidebar); primary page title — agent name lives in the shell breadcrumb. */
  sectionTitle: string;
  status: "draft" | "published";
  unsaved: boolean;
  /** When true, Save changes button shows loading state. */
  saving?: boolean;
  formId: string;
  previewHref?: string;
  /** Brief success message (e.g. "Saved."). Shown below the header. */
  saveMessage?: string | null;
  children: React.ReactNode;
}

export function BotEditorPane({
  sectionTitle,
  status,
  unsaved,
  saving = false,
  formId,
  previewHref,
  saveMessage,
  children,
}: BotEditorPaneProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] dark:bg-slate-900/85 dark:ring-white/[0.06]">
      <div className="sticky top-0 z-20 flex shrink-0 flex-col bg-white/90 backdrop-blur-md dark:bg-slate-900/95">
        <div className="flex flex-col gap-3 border-b border-slate-200/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7 dark:border-slate-700/80">
          <div className="min-w-0 flex flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[1.35rem]">
                {sectionTitle}
              </h1>
              <span
                className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                  status === "published"
                    ? "bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {status === "published" ? "Published" : "Draft"}
              </span>
              {unsaved ? (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Unsaved changes</span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {previewHref ? (
              <Link
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition-colors hover:border-teal-200/90 hover:bg-teal-50/90 hover:text-brand-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                title="Open public demo link"
                aria-label="Open public demo link"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </Link>
            ) : null}
            <button
              type="submit"
              form={formId}
              disabled={saving}
              className="inline-flex h-10 min-w-[9.5rem] items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-sm shadow-teal-900/10 transition-colors hover:bg-brand-600 disabled:pointer-events-none disabled:opacity-70 dark:shadow-none"
              aria-busy={saving}
            >
              {saving ? (
                <>
                  <svg
                    className="h-4 w-4 shrink-0 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeOpacity={0.25}
                    />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      opacity={0.75}
                    />
                  </svg>
                  Saving
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </div>
        {saveMessage ? (
          <div className="border-b border-emerald-100/90 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/40 dark:text-emerald-200 sm:px-6">
            {saveMessage}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
