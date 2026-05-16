"use client";

import type { InternalAnalyticsDatePreset } from "@/types/internal-analytics";

const PRESET_LABEL: Record<InternalAnalyticsDatePreset, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};

function cx(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

export function AnalyticsDateRangeToolbar({
  activePreset,
  onPresetChange,
  rangeLabel,
  disabled,
}: {
  activePreset: InternalAnalyticsDatePreset;
  onPresetChange: (preset: InternalAnalyticsDatePreset) => void;
  /** Human-readable window from the API (ISO from–to). */
  rangeLabel: string;
  disabled?: boolean;
}) {
  const presets: InternalAnalyticsDatePreset[] = ["7d", "30d", "90d"];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white/80 p-1 dark:border-gray-800 dark:bg-gray-900/60">
        {presets.map((p) => {
          const isActive = p === activePreset;
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onPresetChange(p)}
              className={cx(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {PRESET_LABEL[p]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-500 tabular-nums">{rangeLabel}</p>
    </div>
  );
}
