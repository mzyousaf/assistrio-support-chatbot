"use client";

import React from "react";
import { SettingsDependencyAlert } from "./SettingsDependencyAlert";
import { SettingsHelperText } from "./SettingsHelperText";
import { SettingsLabel } from "./SettingsLabel";

export interface SettingsFieldRowProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  helperText?: React.ReactNode;
  tooltip?: string;
  dependencyNote?: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SettingsFieldRow({
  label,
  htmlFor,
  required,
  helperText,
  tooltip,
  dependencyNote,
  disabled,
  children,
  className = "",
}: SettingsFieldRowProps) {
  const showDependencyAlert = disabled && dependencyNote;

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {label ? (
        <SettingsLabel htmlFor={htmlFor} required={required} tooltip={tooltip}>
          {label}
        </SettingsLabel>
      ) : null}
      {helperText ? (
        <SettingsHelperText>{helperText}</SettingsHelperText>
      ) : null}
      <div className={disabled ? "pointer-events-none opacity-60" : undefined}>
        {children}
      </div>
      {showDependencyAlert ? (
        <SettingsDependencyAlert>{dependencyNote}</SettingsDependencyAlert>
      ) : null}
    </div>
  );
}
