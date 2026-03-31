import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type NormalizedSource = ChatUISource & { _key: string };

/** Normalize raw API sources. */
function normalizeSources(sources: ChatUISource[]): NormalizedSource[] {
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

function scorePreferred(a: NormalizedSource, b: NormalizedSource): boolean {
  if (a.score != null && b.score != null) return a.score > b.score;
  if (a.score != null) return true;
  if (b.score != null) return false;
  return false;
}

/**
 * Unique sources: key by `documentId` when present, else by normalized title.
 * When merging duplicates, keep the row with the higher relevance score.
 */
function dedupeSourcesForDisplay(items: NormalizedSource[]): NormalizedSource[] {
  const map = new Map<string, NormalizedSource>();
  for (const s of items) {
    const doc = s.documentId?.trim();
    const titleKey = s.title.toLowerCase().replace(/\s+/g, " ").trim();
    const key = doc || (titleKey ? `title:${titleKey}` : s._key);
    const prev = map.get(key);
    if (!prev || scorePreferred(s, prev)) map.set(key, s);
  }
  return Array.from(map.values());
}

function SourcesModal({
  open,
  onClose,
  dark,
  label,
  items,
  titleId,
  onSourceClick,
}: {
  open: boolean;
  onClose: () => void;
  dark: boolean;
  label: string;
  items: NormalizedSource[];
  titleId: string;
  onSourceClick?: (source: ChatUISource) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483646] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px] cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "relative w-full sm:max-w-lg sm:max-h-[min(85vh,560px)] max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border shadow-2xl outline-none",
          dark ? "bg-gray-900 border-gray-600/90 text-gray-100" : "bg-white border-gray-200 text-gray-900"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cx(
            "flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0",
            dark ? "border-gray-700/80" : "border-gray-200"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <DocumentIcon className="h-5 w-5 flex-shrink-0 opacity-80" />
            <h2 id={titleId} className="text-sm font-semibold truncate">
              {label}
            </h2>
            <span
              className={cx(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums shrink-0",
                dark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
              )}
            >
              {items.length}
            </span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className={cx(
              "rounded-lg p-2 transition-colors shrink-0",
              dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            )}
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ul className="overflow-y-auto flex-1 min-h-0 py-2 px-2 sm:px-3" role="list">
          {items.map((s) => {
            const { _key, ...rest } = s;
            const body = (
              <>
                <p className="text-sm font-medium leading-snug break-words">{s.title}</p>
                {s.snippet ? (
                  <p
                    className={cx(
                      "mt-1.5 text-xs leading-relaxed line-clamp-4",
                      dark ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    {s.snippet}
                  </p>
                ) : null}
                {typeof s.score === "number" ? (
                  <p className={cx("mt-1 text-[10px] uppercase tracking-wide", dark ? "text-gray-500" : "text-gray-400")}>
                    Relevance {s.score.toFixed(2)}
                  </p>
                ) : null}
              </>
            );
            return (
              <li key={s._key} className="mb-2 last:mb-0">
                {onSourceClick ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSourceClick(rest);
                      onClose();
                    }}
                    className={cx(
                      "w-full text-left rounded-xl border px-3 py-2.5 transition-colors",
                      dark
                        ? "border-gray-700/80 bg-gray-800/40 hover:bg-gray-800 hover:border-gray-600"
                        : "border-gray-200 bg-gray-50/80 hover:bg-gray-100 hover:border-gray-300"
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <div
                    className={cx(
                      "rounded-xl border px-3 py-2.5",
                      dark ? "border-gray-700/80 bg-gray-800/30" : "border-gray-200 bg-gray-50/80"
                    )}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
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
  const reactId = useId();
  const titleId = `chat-sources-title-${messageId}-${reactId.replace(/:/g, "")}`;

  const normalized = useMemo(() => normalizeSources(sources), [sources]);
  const unique = useMemo(() => dedupeSourcesForDisplay(normalized), [normalized]);

  const handleClose = useCallback(() => setOpen(false), []);

  if (unique.length === 0) return null;

  return (
    <>
      <div className={cx("inline-flex", className)}>
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
          aria-haspopup="dialog"
        >
          <DocumentIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
          <span>{label}</span>
          <span
            className={cx(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              dark ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-600"
            )}
          >
            {unique.length}
          </span>
        </button>
      </div>
      <SourcesModal
        open={open}
        onClose={handleClose}
        dark={dark}
        label={label}
        items={unique}
        titleId={titleId}
        onSourceClick={onSourceClick}
      />
    </>
  );
}
