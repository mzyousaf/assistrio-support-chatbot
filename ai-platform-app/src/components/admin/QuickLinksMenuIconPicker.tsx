"use client";

import React from "react";

import { getQuickLinkIcon, QUICK_LINK_ICON_IDS, type QuickLinkIconId } from "@assistrio/chat-widget";

import { normalizeQuickLinkIcon } from "@/lib/quickLinkIconNormalize";

export interface QuickLinksMenuIconPickerProps {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}

/** Matches previous widget default (Link2). Stored as omitted / undefined. */
const DEFAULT_MENU_ICON_ID = "link-2";

/**
 * Icon for the header button that opens the quick links dropdown (not per-link icons).
 */
export function QuickLinksMenuIconPicker({ value, onChange }: QuickLinksMenuIconPickerProps) {
  const normalized = normalizeQuickLinkIcon(value);

  const defaultBtnActive = !normalized;
  const cellActive = (id: QuickLinkIconId) =>
    normalized ? normalized === id : id === DEFAULT_MENU_ICON_ID;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
            defaultBtnActive
              ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          }`}
        >
          Default (link)
        </button>
      </div>
      <div className="grid max-h-[176px] grid-cols-7 gap-1.5 overflow-y-auto rounded-md border border-gray-200 p-1.5 dark:border-gray-600 sm:grid-cols-9">
        {QUICK_LINK_ICON_IDS.map((id: QuickLinkIconId) => {
          const Icon = getQuickLinkIcon(id);
          return (
            <button
              key={id}
              type="button"
              title={id}
              onClick={() => onChange(id === DEFAULT_MENU_ICON_ID ? undefined : id)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                cellActive(id)
                  ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
                  : "border-transparent bg-gray-50 text-gray-700 hover:border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
