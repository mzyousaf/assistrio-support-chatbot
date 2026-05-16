"use client";

import React, { useEffect, useRef } from "react";

export interface SettingsSideSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Footer slot: e.g. Save / Cancel buttons */
  footer?: React.ReactNode;
}

export function SettingsSideSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: SettingsSideSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyActive = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0] as HTMLElement | undefined;
    first?.focus?.();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyActive?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-side-sheet-title"
    >
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative flex h-full w-full max-h-full flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        style={{ width: "min(100%, 28rem)" }}
      >
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 id="settings-side-sheet-title" className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer != null ? (
          <div className="grid min-h-[3.5rem] shrink-0 grid-cols-2 items-stretch gap-3 border-t border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30 [&>*]:h-full [&>*]:rounded-none">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
