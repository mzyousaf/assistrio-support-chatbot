"use client";

import React from "react";
import { Upload, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatSize } from "./documents-utils";

interface DocumentsToolbarProps {
  disabled: boolean;
  selectedFiles: File[];
  isUploading: boolean;
  isRetryingAll: boolean;
  failedCount: number;
  dragOver: boolean;
  onAddFilesClick: () => void;
  onUpload: () => void;
  onRemoveFile: (file: File) => void;
  onRetryAllFailed: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  /** When true, only the selected-files list is rendered (buttons are in the section header). */
  buttonsInHeader?: boolean;
}

export function DocumentsToolbar({
  disabled,
  selectedFiles,
  isUploading,
  isRetryingAll,
  failedCount,
  dragOver,
  onAddFilesClick,
  onUpload,
  onRemoveFile,
  onRetryAllFailed,
  onDragOver,
  onDragLeave,
  onDrop,
  buttonsInHeader = false,
}: DocumentsToolbarProps) {
  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={onAddFilesClick}
          disabled={disabled}
          size="sm"
          className="inline-flex items-center gap-1.5"
          title="Add files"
        >
          <Upload className="h-4 w-4 shrink-0" aria-hidden />
          <span>Add files</span>
        </Button>
        {failedCount >= 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 inline-flex items-center gap-1.5 border border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-200 dark:hover:bg-amber-900/40"
            disabled={isRetryingAll}
            onClick={onRetryAllFailed}
            title="Retry all failed"
          >
            {isRetryingAll ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{isRetryingAll ? "Retrying…" : "Retry all failed"}</span>
          </Button>
        ) : null}
    </div>
  );

  if (buttonsInHeader) {
    return null;
  }

  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3.5 shadow-sm transition-colors ${
        dragOver ? "border-brand-400 dark:border-brand-500 bg-brand-50/80 dark:bg-brand-900/20" : ""
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label="Document actions"
    >
      {actionButtons}
      {selectedFiles.length > 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Selected for upload
          </p>
          <ul className="space-y-1.5">
            {selectedFiles.map((file, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-white dark:bg-gray-900/50 px-2.5 py-1.5 border border-gray-100 dark:border-gray-700"
              >
                <span className="min-w-0 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                  {file.name}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatSize(file.size)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400"
                    onClick={() => onRemoveFile(file)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex justify-end">
            <Button type="button" size="sm" disabled={disabled || selectedFiles.length === 0} onClick={onUpload}>
              {isUploading ? "Uploading…" : "Upload selected"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DocumentsHeaderActions({
  disabled,
  isRetryingAll,
  failedCount,
  onAddFilesClick,
  onRetryAllFailed,
}: Pick<
  DocumentsToolbarProps,
  "disabled" | "isRetryingAll" | "failedCount" | "onAddFilesClick" | "onRetryAllFailed"
>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        onClick={onAddFilesClick}
        disabled={disabled}
        size="sm"
        className="inline-flex items-center gap-1.5"
        title="Add files"
      >
        <Upload className="h-4 w-4 shrink-0" aria-hidden />
        <span>Add files</span>
      </Button>
      {failedCount >= 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-w-0 inline-flex items-center gap-1.5 border border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-200 dark:hover:bg-amber-900/40"
          disabled={isRetryingAll}
          onClick={onRetryAllFailed}
          title="Retry all failed"
        >
          {isRetryingAll ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span>{isRetryingAll ? "Retrying…" : "Retry all failed"}</span>
        </Button>
      ) : null}
    </div>
  );
}
