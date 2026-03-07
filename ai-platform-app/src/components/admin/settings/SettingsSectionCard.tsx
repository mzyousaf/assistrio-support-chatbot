"use client";

import React from "react";

export interface SettingsSectionCardProps {
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSectionCard({
  title,
  description,
  headerAction,
  children,
  className = "",
}: SettingsSectionCardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/50 ${className}`.trim()}
    >
      {(title || description || headerAction) ? (
        <div className="flex flex-col gap-1.5 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0 pt-1 sm:pt-0">{headerAction}</div> : null}
        </div>
      ) : null}
      <div className="space-y-5 p-5">{children}</div>
    </div>
  );
}
