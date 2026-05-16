"use client";

import React from "react";
import { formatSize, formatDate, getStatusMeta, truncateMessage } from "./documents-utils";
import type { DocumentStatus } from "./documents-utils";

export interface DocumentForStatus {
  _id: string;
  title: string;
  fileName?: string;
  fileSize?: number;
  status?: DocumentStatus;
  error?: string;
  createdAt?: string;
}

const STATUS_ORDER: DocumentStatus[] = ["queued", "processing", "ready", "failed"];

const GROUP_STYLES: Record<
  DocumentStatus,
  { label: string; border: string; borderLeft: string; bg: string; header: string; count: string }
> = {
  queued: {
    label: "Queued",
    border: "border-gray-200 dark:border-gray-600",
    borderLeft: "border-l-4 border-l-gray-400 dark:border-l-gray-500",
    bg: "bg-gray-50/80 dark:bg-gray-800/30",
    header: "text-gray-700 dark:text-gray-300",
    count: "text-gray-600 dark:text-gray-400",
  },
  processing: {
    label: "Processing",
    border: "border-blue-200 dark:border-blue-800",
    borderLeft: "border-l-4 border-l-blue-500 dark:border-l-blue-400",
    bg: "bg-blue-50/70 dark:bg-blue-900/25",
    header: "text-blue-800 dark:text-blue-200",
    count: "text-blue-700 dark:text-blue-300",
  },
  ready: {
    label: "Ready",
    border: "border-emerald-200 dark:border-emerald-800",
    borderLeft: "border-l-4 border-l-emerald-500 dark:border-l-emerald-400",
    bg: "bg-emerald-50/70 dark:bg-emerald-900/25",
    header: "text-emerald-800 dark:text-emerald-200",
    count: "text-emerald-700 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    border: "border-red-200 dark:border-red-800",
    borderLeft: "border-l-4 border-l-red-500 dark:border-l-red-400",
    bg: "bg-red-50/80 dark:bg-red-900/25",
    header: "text-red-800 dark:text-red-200",
    count: "text-red-700 dark:text-red-300",
  },
};

interface DocumentsByStatusProps {
  items: DocumentForStatus[];
}

function groupByStatus(items: DocumentForStatus[]): Map<DocumentStatus, DocumentForStatus[]> {
  const map = new Map<DocumentStatus, DocumentForStatus[]>();
  for (const status of STATUS_ORDER) {
    map.set(status, []);
  }
  for (const doc of items) {
    const s = doc.status ?? "queued";
    if (STATUS_ORDER.includes(s)) {
      map.get(s)!.push(doc);
    } else {
      map.get("queued")!.push(doc);
    }
  }
  return map;
}

export function DocumentsByStatus({ items }: DocumentsByStatusProps) {
  const groups = groupByStatus(items);

  return (
    <section aria-label="Documents by status" className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Documents by status
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const docs = groups.get(status) ?? [];
          if (docs.length === 0) return null;

          const style = GROUP_STYLES[status];
          const meta = getStatusMeta(status);
          const isFailed = status === "failed";

          return (
            <div
              key={status}
              className={`rounded-xl border overflow-hidden shadow-sm ${style.border} ${style.bg} ${isFailed ? "ring-1 ring-red-200/60 dark:ring-red-800/50" : ""}`}
            >
              <div
                className={`${style.borderLeft} px-3 py-2 flex items-center justify-between gap-2 border-b border-gray-200/70 dark:border-gray-700/70`}
              >
                <span className={`text-[11px] font-bold uppercase tracking-widest ${style.header}`}>
                  {style.label}
                </span>
                <span className={`text-sm font-bold tabular-nums ${style.count}`}>{docs.length}</span>
              </div>
              <ul className="divide-y divide-gray-200/80 dark:divide-gray-700/80 max-h-44 overflow-y-auto">
                {docs.map((doc) => (
                  <li key={doc._id} className="px-3 py-2 min-w-0">
                    <p
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                      title={doc.title || doc.fileName || undefined}
                    >
                      {doc.title || doc.fileName || doc._id}
                    </p>
                    {(doc.fileSize != null || doc.createdAt) && !isFailed ? (
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {[doc.fileSize != null ? formatSize(doc.fileSize) : null, doc.createdAt ? formatDate(doc.createdAt) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {isFailed && doc.error ? (
                      <div
                        className="mt-1.5 rounded-md border border-red-200/80 bg-red-100/60 px-2 py-1.5 dark:border-red-800/80 dark:bg-red-900/40"
                        title={doc.error}
                      >
                        <p className="text-xs font-medium text-red-800 dark:text-red-200 line-clamp-2 leading-snug">
                          {truncateMessage(doc.error, 100)}
                        </p>
                      </div>
                    ) : isFailed && !doc.error ? (
                      <p className="mt-1 text-[11px] text-red-600/90 dark:text-red-400/90">No error details</p>
                    ) : null}
                    {!isFailed ? (
                      <span
                        className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
