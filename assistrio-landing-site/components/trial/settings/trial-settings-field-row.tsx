import type { ReactNode } from "react";

type Props = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helperText?: string;
  dependencyNote?: string;
  disabled?: boolean;
  children: ReactNode;
};

export function TrialSettingsFieldRow({
  label,
  htmlFor,
  required,
  helperText,
  dependencyNote,
  disabled,
  children,
}: Props) {
  return (
    <div className={`min-w-0 space-y-1.5 ${disabled ? "opacity-80" : ""}`.trim()}>
      <label
        htmlFor={htmlFor}
        className={`flex flex-wrap items-baseline gap-x-1 text-[13px] font-medium text-slate-700 ${disabled ? "cursor-not-allowed" : ""}`.trim()}
      >
        <span>
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </span>
      </label>
      {dependencyNote ? <p className="text-[11px] leading-snug text-slate-500">{dependencyNote}</p> : null}
      {children}
      {helperText ? <p className="text-[12px] leading-relaxed text-slate-500/85">{helperText}</p> : null}
    </div>
  );
}
