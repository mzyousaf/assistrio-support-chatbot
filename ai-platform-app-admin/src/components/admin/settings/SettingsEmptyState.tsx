"use client";

import React from "react";

export interface SettingsEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const DefaultIcon = () => (
  <svg
    className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5v-7.5H8.25v7.5z"
    />
  </svg>
);

export function SettingsEmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: SettingsEmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-10 text-center dark:border-gray-600 dark:bg-gray-800/30 ${className}`.trim()}
    >
      <div className="flex justify-center">{icon ?? <DefaultIcon />}</div>
      <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
      {description ? (
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
