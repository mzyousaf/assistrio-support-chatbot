"use client";

import React from "react";

export interface FormSectionHeaderProps {
  title?: string;
  description?: string;
  className?: string;
}

export function FormSectionHeader({ title, description, className = "" }: FormSectionHeaderProps) {
  if (!title && !description) return null;

  return (
    <div className={className.trim() || undefined}>
      {title && (
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
      )}
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}
