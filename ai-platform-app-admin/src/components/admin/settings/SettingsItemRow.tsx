"use client";

import React from "react";

export interface SettingsItemRowProps {
  children: React.ReactNode;
  /** Right-side actions (Edit / Delete buttons) */
  actions?: React.ReactNode;
  className?: string;
}

export function SettingsItemRow({ children, actions, className = "" }: SettingsItemRowProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white py-2.5 px-3 transition-colors hover:bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/50 dark:hover:bg-gray-800/60 ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
