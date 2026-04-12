"use client";

import React from "react";

export interface FormFieldDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function FormFieldDescription({ children, className = "" }: FormFieldDescriptionProps) {
  return (
    <p className={`text-xs text-gray-500 dark:text-gray-400 ${className}`.trim()}>{children}</p>
  );
}
