"use client";

import React, { useEffect, useRef } from "react";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Optional icon shown beside the title (e.g. refresh action). */
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Footer slot: e.g. Save / Cancel buttons */
  footer?: React.ReactNode;
  /** Optional max width class (default: max-w-sm) */
  maxWidthClass?: string;
}

export function SettingsModal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  maxWidthClass = "max-w-sm",
}: SettingsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyActive = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0] as HTMLElement | undefined;
    first?.focus?.();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px] dark:bg-black/60"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`relative w-full ${maxWidthClass} flex flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-2xl shadow-gray-900/[0.08] ring-1 ring-black/[0.04] dark:border-gray-700/90 dark:bg-gray-900 dark:shadow-black/50 dark:ring-white/[0.06]`}
      >
        <div className="flex shrink-0 gap-4 border-b border-gray-100 bg-white/90 px-5 py-4 dark:border-gray-800 dark:bg-gray-900/80 sm:px-6 sm:py-5">
          {icon ? (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50/90 text-emerald-700 shadow-sm dark:from-emerald-950/50 dark:via-gray-900 dark:to-teal-950/30 dark:text-emerald-400"
              aria-hidden
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="settings-modal-title" className="text-[1.05rem] font-semibold leading-snug tracking-tight text-gray-900 dark:text-gray-50">
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer != null ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-4 backdrop-blur-[1px] dark:border-gray-800 dark:bg-gray-900/60 sm:gap-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
