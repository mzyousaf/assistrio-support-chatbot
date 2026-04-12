"use client";

import React from "react";
import { Button } from "@/components/ui/Button";

const PencilIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export interface SettingsActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  disabled?: boolean;
  /** Disable only the edit/pencil action (icon-only mode friendly). */
  editDisabled?: boolean;
  /** Disable only the delete/trash action (icon-only mode friendly). */
  deleteDisabled?: boolean;
  /** When true, show "Edit" / "Remove" text next to icons */
  showLabels?: boolean;
}

export function SettingsActionMenu({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Remove",
  disabled = false,
  editDisabled,
  deleteDisabled,
  showLabels = true,
}: SettingsActionMenuProps) {
  const effectiveEditDisabled = disabled || editDisabled === true;
  const effectiveDeleteDisabled = disabled || deleteDisabled === true;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={effectiveEditDisabled}
        className={
          showLabels
            ? "gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
            : "h-8 w-8 p-0 bg-transparent text-brand-600 !shadow-none outline-none ring-0 hover:bg-brand-100 !focus:ring-0 !focus:ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
        }
        onClick={onEdit}
        aria-label={editLabel}
      >
        <PencilIcon />
        {showLabels ? <span>{editLabel}</span> : null}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={effectiveDeleteDisabled}
        className={
          showLabels
            ? "gap-1.5 text-xs font-medium text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
            : "h-8 w-8 p-0 bg-transparent text-red-600 !shadow-none outline-none ring-0 hover:bg-red-100 !focus:ring-0 !focus:ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        }
        onClick={onDelete}
        aria-label={deleteLabel}
      >
        <TrashIcon />
        {showLabels ? <span>{deleteLabel}</span> : null}
      </Button>
    </>
  );
}
