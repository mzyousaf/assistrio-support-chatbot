import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./utils";

export interface ClampedTextWithSeeMoreProps {
  text: string;
  /** Shown as the modal heading when “See more” is opened. */
  modalTitle?: string;
  maxLines?: number;
  className?: string;
  seeMoreLabel?: string;
  seeMoreClassName?: string;
  dark?: boolean;
}

function SeeMoreDetailsModal({
  open,
  title,
  description,
  dark,
  onClose,
  titleId,
}: {
  open: boolean;
  title: string;
  description: string;
  dark: boolean;
  onClose: () => void;
  titleId: string;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
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
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border shadow-2xl outline-none sm:max-h-[min(85vh,560px)] sm:rounded-2xl",
          dark ? "border-gray-600/90 bg-gray-900 text-gray-200" : "border-gray-200 bg-white text-gray-800",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cx(
            "flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3",
            dark ? "border-gray-700/80" : "border-gray-200",
          )}
        >
          <h2 id={titleId} className="min-w-0 pr-2 text-base font-semibold leading-snug tracking-tight">
            {title}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className={cx(
              "shrink-0 rounded-lg p-2 transition-colors",
              dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800",
            )}
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p
            className={cx(
              "m-0 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]",
              dark ? "text-gray-300" : "text-gray-600",
            )}
          >
            {description}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Clamps long plain text after `maxLines` and opens a modal with title + full description on “See more”.
 */
export function ClampedTextWithSeeMore({
  text,
  modalTitle,
  maxLines = 10,
  className,
  seeMoreLabel = "See more",
  seeMoreClassName,
  dark = false,
}: ClampedTextWithSeeMoreProps) {
  const trimmed = text.trim();
  const textRef = useRef<HTMLParagraphElement>(null);
  const titleId = useId();
  const [modalOpen, setModalOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [trimmed, maxLines]);

  if (!trimmed) return null;

  const resolvedModalTitle = (modalTitle ?? "").trim() || "Details";

  return (
    <>
      <div className="min-w-0">
        <p
          ref={textRef}
          className={cx(className, "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical]")}
          style={{ WebkitLineClamp: maxLines }}
        >
          {trimmed}
        </p>
        {truncated ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={cx(
              "mt-1 inline-block border-0 bg-transparent p-0 text-left text-xs font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              dark ? "text-indigo-300 focus-visible:outline-indigo-400" : "text-teal-700 focus-visible:outline-teal-600",
              seeMoreClassName,
            )}
          >
            {seeMoreLabel}
          </button>
        ) : null}
      </div>
      <SeeMoreDetailsModal
        open={modalOpen}
        title={resolvedModalTitle}
        description={trimmed}
        dark={dark}
        titleId={titleId}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
