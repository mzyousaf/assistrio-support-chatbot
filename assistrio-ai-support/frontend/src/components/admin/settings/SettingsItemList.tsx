"use client";

import React from "react";

export interface SettingsItemListProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsItemList({ children, className = "" }: SettingsItemListProps) {
  return <div className={`space-y-2 ${className}`.trim()}>{children}</div>;
}
