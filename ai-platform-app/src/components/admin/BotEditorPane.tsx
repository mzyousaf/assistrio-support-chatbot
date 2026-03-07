"use client";

import React from "react";
import Link from "next/link";

import CreateNewBotButton from "./CreateNewBotButton";

export interface BotEditorPaneProps {
  botName: string;
  status: "draft" | "published";
  unsaved: boolean;
  formId: string;
  previewHref?: string;
  children: React.ReactNode;
}

export function BotEditorPane({
  botName,
  status,
  unsaved,
  formId,
  previewHref,
  children,
}: BotEditorPaneProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden flex flex-col min-h-0">
      {/* Sticky action bar */}
      <div className="flex-shrink-0 sticky top-0 z-10 flex items-center justify-between gap-4 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
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
          <CreateNewBotButton
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            label="New bot"
          />
          <button
            type="submit"
            form={formId}
            className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>

      {/* Section nav + content (single surface, no nested card) */}
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
