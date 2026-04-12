"use client";

import React from "react";
import { formatDate, truncateMessage } from "./documents-utils";

export interface LatestFailedDoc {
  docId: string;
  title: string;
  error?: string;
  updatedAt?: string;
}

interface DocumentsHealthInfoProps {
  lastIngestedAt?: string;
  latestFailed?: LatestFailedDoc;
}

export function DocumentsHealthInfo({ lastIngestedAt, latestFailed }: DocumentsHealthInfoProps) {
  const hasAny = lastIngestedAt || latestFailed;
  if (!hasAny) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 px-4 py-3">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        Health &amp; status
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {lastIngestedAt ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Last ingested</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatDate(lastIngestedAt)}
            </p>
          </div>
        ) : null}
        {latestFailed ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-700 dark:bg-red-900/25">
            <p className="text-[11px] font-bold text-red-700 dark:text-red-300">Latest failed</p>
            <p className="mt-0.5 text-sm font-semibold text-red-800 dark:text-red-200">
              {latestFailed.title || latestFailed.docId}
            </p>
            {latestFailed.error ? (
              <p className="mt-1.5 text-xs leading-relaxed text-red-700 dark:text-red-300/90">
                {truncateMessage(latestFailed.error, 280)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
