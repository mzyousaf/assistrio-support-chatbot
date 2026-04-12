"use client";

import React from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="relative inline-flex items-center group">
      <span className="inline-flex items-center">{children}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden min-w-[14rem] max-w-md -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-float group-hover:block group-focus-within:block dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      >
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-gray-200 bg-white" />
        {content}
      </span>
    </span>
  );
}
