"use client";

import React from "react";
import { Button } from "@/components/ui/Button";

const TrashIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export interface SettingsListBuilderItemProps {
  /** Optional title or item number (e.g. "Question 1", "Link 2") */
  title?: React.ReactNode;
  onRemove: () => void;
  removeLabel?: string;
  children: React.ReactNode;
  className?: string;
  /** When true, remove button is disabled (e.g. parent section disabled) */
  removeDisabled?: boolean;
}

const CARD_CLASS =
  "rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50";

export function SettingsListBuilderItem({
  title,
  onRemove,
  removeLabel = "Remove",
  children,
  className = "",
  removeDisabled = false,
}: SettingsListBuilderItemProps) {
  return (
    <div className={`${CARD_CLASS} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        {title != null ? (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={removeDisabled}
          className="shrink-0 gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <TrashIcon />
          {removeLabel}
        </Button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
