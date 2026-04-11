"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { TrialFieldShell } from "@/components/trial/dashboard/trial-forms/trial-field-shell";
import { trialFieldInputClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";

export type TrialTextInputProps = {
  id: string;
  label: ReactNode;
  labelTrailing?: ReactNode;
  labelSrOnly?: boolean;
  hint?: string;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

export const TrialTextInput = forwardRef<HTMLInputElement, TrialTextInputProps>(function TrialTextInput(
  { id, label, labelTrailing, labelSrOnly, hint, error, ...rest },
  ref,
) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <TrialFieldShell id={id} label={label} labelTrailing={labelTrailing} labelSrOnly={labelSrOnly} hint={hint} error={error}>
      <input
        ref={ref}
        id={id}
        className={trialFieldInputClass}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...rest}
      />
    </TrialFieldShell>
  );
});
