"use client";

import React from "react";

export interface SettingsDependencyAlertProps {
  children: React.ReactNode;
  className?: string;
}

const InfoIcon = () => (
  <svg
    className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export function SettingsDependencyAlert({
  children,
  className = "",
}: SettingsDependencyAlertProps) {
  return (
    <div
      className={`mt-2 flex items-start gap-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400 ${className}`.trim()}
      role="status"
    >
      <InfoIcon />
      <span>{children}</span>
    </div>
  );
}
