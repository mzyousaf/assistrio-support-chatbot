"use client";

import React from "react";

export interface SettingsInputShellProps {
  children: React.ReactNode;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export function SettingsInputShell({
  children,
  disabled,
  error,
  className = "",
}: SettingsInputShellProps) {
  return (
    <div
      className={[
        "rounded-lg border bg-white transition-colors dark:bg-gray-900",
        "focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500 dark:focus-within:border-brand-400",
        disabled && "pointer-events-none opacity-60",
        error
          ? "border-red-300 dark:border-red-700"
          : "border-gray-300 dark:border-gray-600",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
