"use client";

import React from "react";
import { SettingsInfoTooltip } from "./SettingsInfoTooltip";

export interface SettingsLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  tooltip?: string;
  className?: string;
}

export function SettingsLabel({
  children,
  htmlFor,
  required,
  tooltip,
  className = "",
}: SettingsLabelProps) {
  const label = (
    <span className="font-medium text-gray-700 dark:text-gray-300">{children}</span>
  );

  return (
    <label
      htmlFor={htmlFor}
      className={`flex items-center gap-1.5 text-sm ${className}`.trim()}
    >
      {label}
      {required ? (
        <span className="text-red-500 dark:text-red-400" aria-hidden>
          *
        </span>
      ) : null}
      {tooltip ? (
        <SettingsInfoTooltip content={tooltip} />
      ) : null}
    </label>
  );
}
