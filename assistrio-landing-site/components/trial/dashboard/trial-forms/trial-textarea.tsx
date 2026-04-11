"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { TrialFieldShell } from "@/components/trial/dashboard/trial-forms/trial-field-shell";
import { trialFieldTextareaClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";

type Props = {
  id: string;
  label: ReactNode;
  /** Renders inline after the label (e.g. character count). */
  labelTrailing?: ReactNode;
  labelSrOnly?: boolean;
  hint?: string;
  error?: string;
  className?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">;

export function TrialTextarea({ id, label, labelTrailing, labelSrOnly, hint, error, className, ...rest }: Props) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const areaClass = className ? `${trialFieldTextareaClass} ${className}` : trialFieldTextareaClass;

  return (
    <TrialFieldShell id={id} label={label} labelTrailing={labelTrailing} labelSrOnly={labelSrOnly} hint={hint} error={error}>
      <textarea id={id} className={areaClass} aria-invalid={!!error} aria-describedby={describedBy} {...rest} />
    </TrialFieldShell>
  );
}
