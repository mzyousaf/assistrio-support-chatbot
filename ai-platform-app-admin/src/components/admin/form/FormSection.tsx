"use client";

import React from "react";
import { FormSectionHeader } from "./FormSectionHeader";

export interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className = "" }: FormSectionProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50 ${className}`.trim()}
    >
      {(title || description) && (
        <FormSectionHeader title={title} description={description} className="mb-4" />
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
