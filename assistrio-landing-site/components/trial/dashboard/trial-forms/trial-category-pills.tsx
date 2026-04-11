"use client";

import { trialFieldHintClass } from "@/components/trial/dashboard/trial-forms/trial-field-styles";

export type TrialCategoryOption = { id: string; title: string; description: string };

type Props = {
  id: string;
  selectedIds: string[];
  onToggle: (categoryId: string) => void;
  categories: readonly TrialCategoryOption[];
  hint?: string;
  /** Maximum number of categories that can be selected at once. */
  maxSelected?: number;
  /** When true, only the pill grid (and optional hint) render — use inside a parent `SettingsFieldRow`. */
  hideLabel?: boolean;
};

export function TrialCategoryPills({
  id,
  selectedIds,
  onToggle,
  categories,
  hint,
  maxSelected = 3,
  hideLabel = false,
}: Props) {
  const hintId = `${id}-hint`;
  const labelId = `${id}-label`;
  const selected = new Set(selectedIds);
  const atCap = selected.size >= maxSelected;

  return (
    <div>
      {hideLabel ? null : (
        <p id={labelId} className="mb-1.5 text-[13px] font-medium tracking-tight text-slate-600">
          Category <span className="text-red-600">*</span>
          <span className="ml-1.5 font-medium text-slate-400" aria-hidden>
            ·
          </span>
          <span className="ml-1 text-[12px] font-semibold tabular-nums text-slate-500" aria-live="polite">
            {selectedIds.length}/{maxSelected}
          </span>
        </p>
      )}
      <div
        role="group"
        aria-labelledby={hideLabel ? undefined : labelId}
        aria-label={hideLabel ? "Category presets" : undefined}
        aria-describedby={hint ? hintId : undefined}
        className={hideLabel ? "flex flex-wrap gap-x-2.5 gap-y-2.5" : "mt-2 flex flex-wrap gap-x-2.5 gap-y-2.5"}
      >
        {categories.map((c) => {
          const isOn = selected.has(c.id);
          const disabled = !isOn && atCap;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={isOn}
              disabled={disabled}
              title={disabled ? `You can select up to ${maxSelected} categories` : undefined}
              className={[
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                isOn
                  ? "border-[var(--brand-teal)] bg-[var(--brand-teal)] text-white shadow-sm ring-2 ring-[var(--brand-teal)]/25"
                  : disabled
                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                    : "border-slate-200/95 bg-white text-slate-700 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
              onClick={() => !disabled && onToggle(c.id)}
            >
              {c.title}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p id={hintId} className={trialFieldHintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
