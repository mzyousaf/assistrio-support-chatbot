"use client";

import React from "react";

export type TrialEditorPaneProps = {
  sectionTitle: string;
  status?: "draft" | "published";
  unsaved?: boolean;
  saving?: boolean;
  formId?: string;
  onSaveClick?: () => void;
  saveLabel?: string;
  saveMessage?: string | null;
  children: React.ReactNode;
};

/**
 * Mirrors `ai-platform-app` `BotEditorPane` framing for trial playground pages.
 * Trial-only: no preview link, no dark theme variants (landing workspace is light).
 */
export function TrialEditorPane({
  sectionTitle,
  status = "draft",
  unsaved = false,
  saving = false,
  formId,
  onSaveClick,
  saveLabel = "Save changes",
  saveMessage,
  children,
}: TrialEditorPaneProps) {
  const showSave = Boolean(formId || onSaveClick);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04]">
      <div className="sticky top-0 z-20 flex shrink-0 flex-col bg-white/90 backdrop-blur-md">
        <div className="flex flex-col gap-3 border-b border-slate-200/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7">
          <div className="min-w-0 flex flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[1.35rem]">{sectionTitle}</h1>
              <span
                className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                  status === "published"
                    ? "bg-emerald-500/12 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {status === "published" ? "Published" : "Draft"}
              </span>
              {unsaved ? <span className="text-xs font-medium text-amber-700">Unsaved changes</span> : null}
            </div>
          </div>
          {showSave ? (
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {formId ? (
                <button
                  type="submit"
                  form={formId}
                  disabled={saving}
                  className="inline-flex h-10 min-w-[9.5rem] items-center justify-center gap-2 rounded-xl bg-[var(--brand-teal)] px-5 text-sm font-semibold text-white shadow-sm shadow-teal-900/10 transition-colors hover:opacity-95 disabled:pointer-events-none disabled:opacity-70"
                  aria-busy={saving}
                >
                  {saving ? "Saving…" : saveLabel}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={onSaveClick}
                  className="inline-flex h-10 min-w-[9.5rem] items-center justify-center gap-2 rounded-xl bg-[var(--brand-teal)] px-5 text-sm font-semibold text-white shadow-sm shadow-teal-900/10 transition-colors hover:opacity-95 disabled:pointer-events-none disabled:opacity-70"
                >
                  {saving ? "Saving…" : saveLabel}
                </button>
              )}
            </div>
          ) : null}
        </div>
        {saveMessage ? (
          <div className="border-b border-emerald-100/90 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-900 sm:px-6">
            {saveMessage}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
