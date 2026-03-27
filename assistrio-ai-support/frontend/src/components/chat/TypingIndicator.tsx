"use client";

import React from "react";

import { cx } from "./utils";

export interface TypingIndicatorProps {
  className?: string;
}

/**
 * Animated "someone is typing" indicator (bouncing dots).
 */
export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div
      className={cx(
        "flex justify-start items-center",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="Someone is typing"
    >
      <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-center gap-1">
        <span className="chat-typing-dot w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400" />
        <span className="chat-typing-dot w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400" />
        <span className="chat-typing-dot w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400" />
      </div>
    </div>
  );
}
