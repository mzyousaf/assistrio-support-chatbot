"use client";

import { trialFieldHintClass, trialFieldLabelTextClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";

type Props = {
  id: string;
  label: React.ReactNode;
  colorValue: string;
  textValue: string;
  onColorChange: (hex: string) => void;
  onTextChange: (hex: string) => void;
  hint?: string;
  error?: string;
};

const segmentShellBase =
  "flex min-w-0 max-w-md items-stretch overflow-hidden rounded-sm border bg-white shadow-none transition " +
  "hover:border-slate-400/90 focus-within:border-[var(--brand-teal)] focus-within:shadow-[0_0_0_3px_rgba(13,148,136,0.12)]";

export function TrialColorInput({ id, label, colorValue, textValue, onColorChange, onTextChange, hint, error }: Props) {
  const errorId = `${id}-error`;
  const segmentShell = [
    segmentShellBase,
    error
      ? "border-red-400/90 focus-within:border-red-500 focus-within:shadow-[inset_0_0_0_1px_rgba(220,38,38,0.2),0_0_0_2px_rgba(220,38,38,0.12)]"
      : "border-slate-300/90",
  ].join(" ");

  return (
    <div>
      <label className={`mb-1 ${trialFieldLabelTextClass}`} htmlFor={id}>
        {label}
      </label>
      <div className={segmentShell}>
        <input
          type="color"
          className="h-9 w-11 shrink-0 cursor-pointer border-0 border-r border-slate-200/95 bg-white p-1 outline-none"
          value={colorValue}
          onChange={(e) => onColorChange(e.target.value)}
          aria-label="Pick brand color"
        />
        <input
          id={id}
          type="text"
          className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-1.5 font-mono text-[0.8125rem] text-slate-900 outline-none placeholder:text-slate-400"
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="#0d9488"
          maxLength={32}
          autoComplete="off"
          aria-label="Brand color hex value"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      {hint ? <p className={trialFieldHintClass}>{hint}</p> : null}
      {error ? (
        <p id={errorId} className="mt-2 text-[12px] font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
