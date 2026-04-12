"use client";

import React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatSize } from "./documents-utils";
import { MAX_FILE_SIZE_BYTES } from "./documents-utils";

const ACCEPTED_FORMATS = ".md, .txt, .pdf, .docx, .doc";
const LIMITS_TEXT = `Max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB per file`;

interface DocumentsEmptyUploadStateProps {
  disabled: boolean;
  dragOver: boolean;
  selectedFiles: File[];
  isUploading: boolean;
  onZoneClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onUpload: () => void;
  onRemoveFile: (file: File) => void;
  error?: string | null;
  /** When false, the "Selected for upload" list is not shown inline (e.g. when using a side panel). */
  showSelectedInline?: boolean;
}

export function DocumentsEmptyUploadState({
  disabled,
  dragOver,
  selectedFiles,
  isUploading,
  onZoneClick,
  onDragOver,
  onDragLeave,
  onDrop,
  onUpload,
  onRemoveFile,
  error,
  showSelectedInline = true,
}: DocumentsEmptyUploadStateProps) {
  return (
    <div className="w-full py-4">
      <div className="w-full">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload documents: drag and drop or click to browse"
          className={`relative flex min-h-[180px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 ${
            disabled
              ? "cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-100/80 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500"
              : dragOver
                ? "cursor-pointer border-brand-500 dark:border-brand-400 bg-brand-50/90 dark:bg-brand-900/25 scale-[1.01] shadow-lg shadow-brand-500/10"
                : "cursor-pointer border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/50 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/15 hover:shadow-md"
          }`}
          onClick={disabled ? undefined : onZoneClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) onZoneClick();
            }
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors ${
              disabled
                ? "bg-gray-200 dark:bg-gray-700/60 text-gray-400"
                : dragOver
                  ? "bg-brand-100 dark:bg-brand-900/50 text-brand-600 dark:text-brand-400"
                  : "bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400"
            }`}
          >
            <Upload className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </div>
          <h3 className="mt-4 text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Upload documents
          </h3>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
            {ACCEPTED_FORMATS} · {LIMITS_TEXT}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            Drag &amp; drop here or click to browse
          </p>
        </div>

        {showSelectedInline && selectedFiles.length > 0 ? (
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Selected for upload
            </p>
            <ul className="space-y-2">
              {selectedFiles.map((file, fileIndex) => (
                <li
                  key={fileIndex}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {file.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatSize(file.size)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      onClick={() => onRemoveFile(file)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                disabled={disabled || selectedFiles.length === 0}
                onClick={onUpload}
              >
                {isUploading ? "Uploading…" : "Upload selected files"}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
