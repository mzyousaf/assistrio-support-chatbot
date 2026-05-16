"use client";

import React from "react";

export interface SettingsCollectionHeaderProps {
  /** e.g. "Form fields" */
  title?: string;
  /** e.g. "3 fields" */
  summary?: React.ReactNode;
  /** Primary action (e.g. Add button) */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function SettingsCollectionHeader({
  title,
  summary,
  action,
  children,
  className = "",
}: SettingsCollectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`.trim()}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {title ? (
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{title}</span>
        ) : null}
        {summary != null ? (
          <span className="text-xs text-gray-500 dark:text-gray-500">{summary}</span>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {children}
    </div>
  );
}
