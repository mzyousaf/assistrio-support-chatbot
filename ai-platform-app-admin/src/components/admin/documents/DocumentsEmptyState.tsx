"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { MAX_FILE_SIZE_BYTES } from "./documents-utils";

const ACCEPTED_NOTE = ".md, .txt, .pdf, .docx, .doc";
const LIMITS_NOTE = `Max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB per file`;

interface DocumentsEmptyStateProps {
  disabled: boolean;
  onUploadClick: () => void;
}

export function DocumentsEmptyState({ disabled, onUploadClick }: DocumentsEmptyStateProps) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/40 px-10 py-16 text-center">
      <div className="mx-auto max-w-md">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          No files uploaded yet
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Upload documents to build this bot&apos;s knowledge base. Files are queued for ingestion and will appear in the table once added.
        </p>
        <p className="mt-5 text-xs font-medium text-gray-500 dark:text-gray-500">
          Accepted: {ACCEPTED_NOTE} · {LIMITS_NOTE}
        </p>
        <Button
          type="button"
          className="mt-8"
          disabled={disabled}
          onClick={onUploadClick}
        >
          Upload documents
        </Button>
      </div>
    </div>
  );
}
