"use client";

import React from "react";

export interface SettingsDividerProps {
  className?: string;
}

export function SettingsDivider({ className = "" }: SettingsDividerProps) {
  return (
    <hr
      className={`my-4 border-0 border-t border-gray-200 dark:border-gray-700 ${className}`.trim()}
      role="separator"
    />
  );
}
