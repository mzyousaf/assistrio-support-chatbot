"use client";

import type { ReactNode } from "react";
import { trialFieldHintClass, trialFieldLabelClass, trialFieldLabelTextClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";

type Props = {
  id: string;
  label: ReactNode;
  /** Renders inline after the label (e.g. info button). Not used when labelSrOnly. */
  labelTrailing?: ReactNode;
  labelSrOnly?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Shared label + hint + error chrome for onboarding fields.
 * Place the control as `children` immediately after the label.
 */
export function TrialFieldShell({ id, label, labelTrailing, labelSrOnly, hint, error, children, className = "" }: Props) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const labelBlock =
    labelSrOnly ? (
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
    ) : labelTrailing != null ? (
      <div className="mb-1.5 flex items-center gap-1.5">
        <label htmlFor={id} className={`mb-0 ${trialFieldLabelTextClass}`}>
          {label}
        </label>
        {labelTrailing}
      </div>
    ) : (
      <label htmlFor={id} className={trialFieldLabelClass}>
        {label}
      </label>
    );

  return (
    <div className={className}>
      {labelBlock}
      {children}
      {hint ? (
        <p id={hintId} className={trialFieldHintClass}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-[12px] font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
