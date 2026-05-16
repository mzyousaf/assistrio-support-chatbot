"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { formatSize } from "./documents-utils";
import { MAX_FILE_SIZE_BYTES } from "./documents-utils";

const ACCEPTED_FORMATS = ".md, .txt, .pdf, .docx, .doc";
const LIMITS_TEXT = `Max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB per file`;

interface DocumentsUploadPanelProps {
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
}

export function DocumentsUploadPanel({
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
}: DocumentsUploadPanelProps) {
  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents: drag and drop or click to browse"
        className={`relative rounded-2xl border-2 border-dashed px-6 py-11 text-center transition-all ${
          disabled
            ? "cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500"
            : dragOver
              ? "cursor-pointer border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-900/25 scale-[1.01] shadow-md"
              : "cursor-pointer border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/10"
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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Drag &amp; drop files here, or <span className="text-brand-600 dark:text-brand-400 underline underline-offset-2">browse</span>
        </p>
        <p className="mt-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">{ACCEPTED_FORMATS}</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{LIMITS_TEXT}</p>
      </div>

      {selectedFiles.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
            Selected for upload
          </p>
          <ul className="space-y-2">
            {selectedFiles.map((file, fileIndex) => (
              <li
                key={fileIndex}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-200">{file.name}</span>
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
          <div className="mt-3 flex justify-end">
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
    </div>
  );
}
