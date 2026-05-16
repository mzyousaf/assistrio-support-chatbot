"use client";

import React from "react";

export interface SettingsHelperTextProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsHelperText({ children, className = "" }: SettingsHelperTextProps) {
  return (
    <p className={`text-xs leading-relaxed text-gray-500 dark:text-gray-400 ${className}`.trim()}>
      {children}
    </p>
  );
}
