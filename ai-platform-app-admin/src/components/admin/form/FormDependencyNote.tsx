"use client";

import React from "react";

export interface FormDependencyNoteProps {
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
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export function FormDependencyNote({ children, className = "" }: FormDependencyNoteProps) {
  return (
    <div
      className={`mt-1.5 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400 ${className}`.trim()}
      role="status"
    >
      <InfoIcon />
      <span>{children}</span>
    </div>
  );
}
