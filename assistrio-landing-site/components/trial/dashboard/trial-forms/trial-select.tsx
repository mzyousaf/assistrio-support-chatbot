"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { TrialFieldShell } from "@/components/trial/dashboard/trial-forms/trial-field-shell";
import { trialFieldSelectClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";

const chevronSvg = (
  <svg className="h-[1.125rem] w-[1.125rem] text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden strokeWidth={2.25}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
  </svg>
);

type Option = { value: string; label: string };

type Props = {
  id: string;
  label: ReactNode;
  options: Option[];
  placeholderOption?: string;
  hint?: string;
  error?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className" | "children">;

export function TrialSelect({ id, label, options, placeholderOption, hint, error, ...rest }: Props) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <TrialFieldShell id={id} label={label} hint={hint} error={error}>
      <div className="group relative">
        <select
          id={id}
          className={`${trialFieldSelectClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-80`}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          {...rest}
        >
          {placeholderOption ? (
            <option value="" disabled={false}>
              {placeholderOption}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-sm border-l border-slate-200/95 bg-slate-50/80 text-slate-500 group-hover:border-slate-300/90">
          {chevronSvg}
        </span>
      </div>
    </TrialFieldShell>
  );
}
