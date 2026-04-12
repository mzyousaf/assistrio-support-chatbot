"use client";

import React from "react";

export interface SettingsEmbedPreviewProps {
  /** Small label in the preview header (e.g. “Knowledge notes”, “FAQ”). */
  eyebrow: string;
  /** Optional status pill(s) on the right (e.g. Included / Excluded). */
  badge?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Framed “embedding” preview used in refresh-confirm dialogs so content reads like a snippet, not a raw form field.
 */
export function SettingsEmbedPreview({ eyebrow, badge, children }: SettingsEmbedPreviewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/90 bg-gradient-to-b from-gray-50/90 to-white shadow-sm dark:border-gray-700/90 dark:from-gray-900/60 dark:to-gray-950/80 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100/90 bg-white/70 px-4 py-2.5 backdrop-blur-[2px] dark:border-gray-800 dark:bg-gray-900/50">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
          {eyebrow}
        </span>
        {badge ? <div className="flex flex-wrap items-center justify-end gap-2">{badge}</div> : null}
      </div>
      <div className="max-h-[min(48vh,22rem)] overflow-y-auto px-4 py-4">{children}</div>
    </div>
  );
}
