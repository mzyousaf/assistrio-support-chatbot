"use client";

import React from "react";

export interface DocumentCounts {
  total: number;
  queued: number;
  processing: number;
  ready: number;
  failed: number;
}

interface DocumentsSummaryCardsProps {
  counts: DocumentCounts;
}

export function DocumentsSummaryCards({ counts }: DocumentsSummaryCardsProps) {
  const hasFailed = counts.failed > 0;
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-5"
      role="region"
      aria-label="Document processing summary"
    >
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total</p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums leading-tight text-gray-900 dark:text-gray-100">
          {counts.total}
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Queued</p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums leading-tight text-gray-700 dark:text-gray-300">
          {counts.queued}
        </p>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-center shadow-sm dark:border-blue-700 dark:bg-blue-900/30">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Processing</p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums leading-tight text-blue-800 dark:text-blue-200">
          {counts.processing}
        </p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-center shadow-sm dark:border-emerald-700 dark:bg-emerald-900/30">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Ready</p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums leading-tight text-emerald-800 dark:text-emerald-200">
          {counts.ready}
        </p>
      </div>
      <div
        className={`rounded-xl border px-4 py-3.5 text-center shadow-sm ${
          hasFailed
            ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/35"
            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        }`}
      >
        <p
          className={`text-[10px] font-bold uppercase tracking-widest ${
            hasFailed ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          Failed
        </p>
        <p
          className={`mt-1.5 text-2xl font-bold tabular-nums leading-tight ${
            hasFailed ? "text-red-800 dark:text-red-100" : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {counts.failed}
        </p>
      </div>
    </div>
  );
}
