"use client";

import React, { useState } from "react";

export type SourceItem = {
  chunkId: string;
  docId: string;
  docTitle: string;
  preview: string;
  score?: number;
};

export interface SourcesAccordionProps {
  sources: SourceItem[];
  messageIndex: number;
  /** Optional: open modal with full chunk text and doc info */
  onSourceClick?: (source: SourceItem) => void;
}

export function SourcesAccordion({
  sources,
  messageIndex,
  onSourceClick,
}: SourcesAccordionProps) {
  const [open, setOpen] = useState(false);

  if (!sources.length) return null;

  return (
    <div className="mt-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={open}
        aria-controls={`sources-list-${messageIndex}`}
        id={`sources-toggle-${messageIndex}`}
      >
        <span>Sources ({sources.length})</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        id={`sources-list-${messageIndex}`}
        role="region"
        aria-labelledby={`sources-toggle-${messageIndex}`}
        className={open ? "border-t border-gray-200 dark:border-gray-600" : "hidden"}
      >
        <ul className="list-none p-0 m-0 divide-y divide-gray-200 dark:divide-gray-600">
          {sources.map((s, i) => (
            <li key={s.chunkId != null ? String(s.chunkId) : `sources-${messageIndex}-${i}`}>
              <div
                className={`px-3 py-2 text-xs ${onSourceClick ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50" : ""}`}
                onClick={() => onSourceClick?.(s)}
                role={onSourceClick ? "button" : undefined}
              >
                <div className="font-medium text-gray-800 dark:text-gray-200">{s.docTitle}</div>
                <p className="mt-0.5 text-gray-600 dark:text-gray-400 line-clamp-2" title={s.preview}>
                  {s.preview}
                </p>
                {s.score != null ? (
                  <p className="mt-0.5 text-gray-500 dark:text-gray-500">Score: {s.score.toFixed(2)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export interface SourceDetailModalProps {
  source: SourceItem | null;
  onClose: () => void;
}

export function SourceDetailModal({ source, onClose }: SourceDetailModalProps) {
  if (!source) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-label="Source detail"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
      />
      <div className="relative w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="flex items-center justify-between flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {source.docTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {source.preview}
        </div>
        {source.score != null ? (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500">
            Relevance: {source.score.toFixed(2)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
