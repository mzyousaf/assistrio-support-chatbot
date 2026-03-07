"use client";

import React from "react";
import { SettingsHelperText } from "./SettingsHelperText";
import { SettingsLabel } from "./SettingsLabel";

export interface SettingsToggleRowProps {
  label: string;
  htmlFor?: string;
  helperText?: React.ReactNode;
  tooltip?: string;
  /** Toggle control (checkbox, switch). Rendered on the right. */
  control?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function SettingsToggleRow({
  label,
  htmlFor,
  helperText,
  tooltip,
  control,
  children,
  className = "",
}: SettingsToggleRowProps) {
  const toggle = control ?? children;
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <SettingsLabel htmlFor={htmlFor} tooltip={tooltip}>
          {label}
        </SettingsLabel>
        {helperText ? (
          <div className="mt-1">
            <SettingsHelperText>{helperText}</SettingsHelperText>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center pt-0.5 sm:pt-0">{toggle}</div>
    </div>
  );
}
