"use client";

import React from "react";
import Link from "next/link";

export interface BotEditorPaneProps {
  botName: string;
  status: "draft" | "published";
  unsaved: boolean;
  /** When true, Save changes button shows loading state. */
  saving?: boolean;
  formId: string;
  previewHref?: string;
  /** Brief success message (e.g. "Saved. Embedding update queued."). Shown below the header. */
  saveMessage?: string | null;
  children: React.ReactNode;
}

export function BotEditorPane({
  botName,
  status,
  unsaved,
  saving = false,
  formId,
  previewHref,
  saveMessage,
  children,
}: BotEditorPaneProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden flex flex-col min-h-0">
      {/* Sticky action bar */}
      <div className="flex-shrink-0 sticky top-0 z-10 flex flex-col border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {botName}
            </h2>
          <span
            className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              status === "published"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            {status === "published" ? "Published" : "Draft"}
          </span>
          {unsaved && (
            <span className="flex-shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {previewHref && (
            <Link
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
          )}
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-70 disabled:pointer-events-none min-w-[7rem]"
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
        {saveMessage && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-100 dark:border-emerald-800/50 text-sm text-emerald-800 dark:text-emerald-200">
            {saveMessage}
          </div>
        )}
      </div>

      {/* Section nav + content (single surface, no nested card) */}
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
