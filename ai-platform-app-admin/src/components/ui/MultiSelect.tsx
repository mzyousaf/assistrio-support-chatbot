"use client";

import React from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  subtitle?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
}

export default function MultiSelect({
  label,
  subtitle,
  options,
  value,
  onChange,
}: MultiSelectProps) {
  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
      return;
    }
    onChange([...value, optionValue]);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">{label}</label>
      {subtitle ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                selected
                  ? "bg-brand-50 border-brand-200 text-brand-700"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
