import React, { useMemo, useState } from "react";
import type { ChatUISource } from "./types";
import { cx } from "./utils";

export interface ChatSourcesProps {
  /** Dark theme (default true) */
  dark?: boolean;
  sources: ChatUISource[];
  messageId?: string;
  label?: string;
  onSourceClick?: (source: ChatUISource) => void;
  className?: string;
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/** Normalize and dedupe sources for display; ensure stable keys. */
function normalizeSources(sources: ChatUISource[]): Array<ChatUISource & { _key: string }> {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((s): s is ChatUISource => s != null && typeof s === "object")
    .map((s, i) => ({
      title: typeof s.title === "string" && s.title.trim() ? s.title.trim() : `Source ${i + 1}`,
      snippet: typeof s.snippet === "string" ? s.snippet.trim() : undefined,
      score: typeof s.score === "number" && Number.isFinite(s.score) ? s.score : undefined,
      documentId: typeof s.documentId === "string" ? s.documentId : undefined,
      chunkId: typeof s.chunkId === "string" ? s.chunkId : undefined,
      _key: [s.documentId, s.chunkId, i].filter(Boolean).join("_") || `src-${i}`,
    }));
}

export function ChatSources({
  dark = true,
  sources,
  messageId = "sources",
  label = "Sources",
  onSourceClick,
  className,
}: ChatSourcesProps) {
  const [open, setOpen] = useState(false);
  const normalized = useMemo(() => normalizeSources(sources), [sources]);

  if (normalized.length === 0) return null;

  return (
    <div className={cx("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          dark
            ? "text-gray-400 hover:bg-gray-700/60 hover:text-gray-300"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        )}
        aria-expanded={open}
        aria-controls={`chat-sources-${messageId}`}
      >
        <DocumentIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
        <span>{label}</span>
        <span
          className={cx(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            dark ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-600"
          )}
        >
          {normalized.length}
        </span>
        <ChevronIcon open={open} />
      </button>
      <div
        id={`chat-sources-${messageId}`}
        className={cx(
          "absolute left-0 top-full mt-2 min-w-[260px] max-w-[min(90vw,340px)] max-h-[55vh] flex flex-col z-50 rounded-xl border shadow-2xl overflow-hidden",
          open ? "flex" : "hidden",
          dark
            ? "bg-gray-800/95 border-gray-600/80 shadow-gray-950/30 backdrop-blur-sm"
            : "bg-white border-gray-200 shadow-gray-900/10"
        )}
      >
        <ul className="py-1 overflow-y-auto flex-1 min-h-0" role="list">
          {normalized.map((s) => (
            <li key={s._key}>
              {onSourceClick ? (
                <button
                  type="button"
                  onClick={() => {
                    const { _key, ...source } = s;
                    onSourceClick(source);
                  }}
                  className={cx(
                    "w-full text-left px-3 py-1.5 text-xs truncate block transition-colors",
                    dark
                      ? "text-gray-300 hover:bg-gray-700/60 hover:text-gray-100"
                      : "text-gray-700 hover:bg-gray-100",
                    "cursor-pointer focus:outline-none"
                  )}
                >
                  {s.title}
                </button>
              ) : (
                <span
                  className={cx(
                    "block w-full text-left px-3 py-1.5 text-xs truncate",
                    dark ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  {s.title}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
