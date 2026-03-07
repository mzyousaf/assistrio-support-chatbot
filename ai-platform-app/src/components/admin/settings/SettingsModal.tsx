"use client";

import React, { useEffect, useRef } from "react";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`relative w-full ${maxWidthClass} flex flex-col rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900`}
      >
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 id="settings-modal-title" className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer != null ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-gray-50/50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/30">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
