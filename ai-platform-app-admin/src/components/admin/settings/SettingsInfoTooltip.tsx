"use client";

import React from "react";
import Tooltip from "@/components/ui/Tooltip";

export interface SettingsInfoTooltipProps {
  content: string;
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

export function SettingsInfoTooltip({ content, className = "" }: SettingsInfoTooltipProps) {
  return (
    <Tooltip content={content}>
      <span
        className={`inline-flex cursor-help ${className}`.trim()}
        tabIndex={0}
        role="img"
        aria-label={content}
      >
        <InfoIcon />
      </span>
    </Tooltip>
  );
}
