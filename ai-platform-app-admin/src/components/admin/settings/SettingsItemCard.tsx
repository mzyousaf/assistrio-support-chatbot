"use client";

import React from "react";

export interface SettingsItemCardProps {
  children: React.ReactNode;
  /** Right-side actions (Edit / Delete buttons) */
  actions?: React.ReactNode;
  className?: string;
}

export function SettingsItemCard({ children, actions, className = "" }: SettingsItemCardProps) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/50 dark:hover:bg-gray-800/60 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-1 sm:pt-0.5">{actions}</div> : null}
    </div>
  );
}
