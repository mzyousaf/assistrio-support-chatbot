"use client";

import React from "react";

export interface SettingsPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SettingsPageHeader({
  title,
  description,
  actions,
  className = "",
}: SettingsPageHeaderProps) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${className}`.trim()}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
