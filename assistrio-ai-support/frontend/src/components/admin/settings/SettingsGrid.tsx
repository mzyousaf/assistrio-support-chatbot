"use client";

import React from "react";

export interface SettingsGridProps {
  children: React.ReactNode;
  /** When true, children can span full width (e.g. fullWidth className on child). */
  fullWidthChildren?: boolean;
  className?: string;
}

/** Add this class to a direct child to span full width (2 columns on desktop). */
export const SETTINGS_GRID_FULL = "md:col-span-2";

export function SettingsGrid({
  children,
  className = "",
}: SettingsGridProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6 md:gap-y-5 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
