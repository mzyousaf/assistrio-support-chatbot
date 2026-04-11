import type { ReactNode } from "react";

type Props = {
  label: string;
  htmlFor?: string;
  helperText?: ReactNode;
  control: ReactNode;
  className?: string;
};

/** Mirrors authenticated `SettingsToggleRow` — label left, control right. */
export function TrialSettingsToggleRow({ label, htmlFor, helperText, control, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-slate-700">
          {label}
        </label>
        {helperText ? <div className="mt-1 text-[12px] leading-relaxed text-slate-500">{helperText}</div> : null}
      </div>
      <div className="flex shrink-0 items-center pt-0.5 sm:pt-0">{control}</div>
    </div>
  );
}
