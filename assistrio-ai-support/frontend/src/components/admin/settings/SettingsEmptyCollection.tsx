"use client";

import React from "react";

export interface SettingsEmptyCollectionProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const DefaultIcon = () => (
  <svg
    className="mx-auto h-9 w-9 text-gray-400 dark:text-gray-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

export function SettingsEmptyCollection({
  icon,
  title,
  description,
  action,
  className = "",
}: SettingsEmptyCollectionProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-8 text-center dark:border-gray-600 dark:bg-gray-800/30 ${className}`.trim()}
    >
      <div className="flex justify-center">{icon ?? <DefaultIcon />}</div>
      <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
      ) : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
