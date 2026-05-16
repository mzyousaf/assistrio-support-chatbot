"use client";

import React from "react";
import { FormDependencyNote } from "./FormDependencyNote";

export interface FormFieldProps {
  label?: string;
  description?: React.ReactNode;
  dependencyNote?: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function FormField({
  label,
  description,
  dependencyNote,
  disabled,
  children,
  className = "",
  id,
}: FormFieldProps) {
  const showDependencyNote = disabled && dependencyNote;

  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
      )}
      {description && <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>}
      <div className={disabled ? "pointer-events-none opacity-60" : undefined}>{children}</div>
      {showDependencyNote && <FormDependencyNote>{dependencyNote}</FormDependencyNote>}
    </div>
  );
}
