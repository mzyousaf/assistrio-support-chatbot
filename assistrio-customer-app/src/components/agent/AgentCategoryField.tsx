import { FieldRow, Input } from '@/components/ui';
import { BOT_FIELD_MAX } from '@/lib/botFieldLimits';
import { cn } from '@/lib/utils';
import {
  CATEGORY_OPTIONS,
  CUSTOM_CATEGORY_PILL,
  MAX_CATEGORY_PILLS,
  type AgentCategoryValue,
  toggleAgentCategoryPill,
} from './categoryUtils';

/** Match onboarding tab/chip accent — teal selected, subtle teal hover. */
const CHIP_SELECTED =
  'border-teal-600 bg-teal-600 text-white hover:border-teal-700 hover:bg-teal-700';
const CHIP_DEFAULT =
  'border-slate-200/90 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800';
const CHIP_DISABLED = 'cursor-not-allowed border-slate-200/80 bg-slate-50/80 text-slate-400';
const CHIP_CUSTOM_DEFAULT =
  'cursor-pointer border-dashed border-slate-300/90 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800';

type Props = {
  value: AgentCategoryValue;
  onChange: (next: AgentCategoryValue) => void;
  disabled?: boolean;
  idPrefix?: string;
  heading?: string;
  error?: string | null;
};

export function AgentCategoryField({
  value,
  onChange,
  disabled,
  idPrefix = 'agent-cat',
  heading = 'Category',
  error = null,
}: Props) {
  const categorySlotsUsed = value.customMode
    ? value.customText.trim()
      ? 1
      : 0
    : value.selectedPredefined.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[0.8125rem] font-medium text-slate-700">{heading}</p>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">
          {categorySlotsUsed}/{MAX_CATEGORY_PILLS}
        </span>
      </div>
      <p className="m-0 text-[0.8125rem] leading-snug text-slate-500">
        Pick at least one category (up to three), or switch to custom when your use case isn&apos;t listed.
      </p>
      <div
        className="rounded-lg border border-slate-200 bg-white p-2.5"
        role="group"
        aria-label="Category presets"
      >
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((c) => {
            const selected = !value.customMode && value.selectedPredefined.includes(c.value);
            const atMax =
              !value.customMode &&
              value.selectedPredefined.length >= MAX_CATEGORY_PILLS &&
              !selected;
            const isLastSelected =
              !value.customMode && selected && value.selectedPredefined.length === 1;
            return (
              <button
                key={c.value}
                type="button"
                disabled={disabled || atMax || isLastSelected}
                className={cn(
                  'inline-flex h-[30px] max-h-[30px] min-h-0 shrink-0 items-center justify-center rounded-full border px-2.5 text-[0.6875rem] leading-none transition-colors duration-150',
                  selected ? 'font-medium' : 'font-normal',
                  selected
                    ? isLastSelected
                      ? 'cursor-default'
                      : CHIP_SELECTED
                    : atMax
                      ? CHIP_DISABLED
                      : CHIP_DEFAULT,
                  isLastSelected && CHIP_SELECTED,
                )}
                aria-pressed={selected}
                title={isLastSelected ? 'At least one category is required' : undefined}
                onClick={() => onChange(toggleAgentCategoryPill(value, c.value))}
              >
                {c.label}
              </button>
            );
          })}
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'inline-flex h-[30px] max-h-[30px] min-h-0 shrink-0 items-center justify-center rounded-full border px-2.5 text-[0.6875rem] leading-none transition-colors duration-150',
              value.customMode ? 'font-medium' : 'font-normal',
              value.customMode
                ? CHIP_SELECTED
                : CHIP_CUSTOM_DEFAULT,
            )}
            aria-pressed={value.customMode}
            onClick={() => onChange(toggleAgentCategoryPill(value, CUSTOM_CATEGORY_PILL))}
          >
            Custom / other
          </button>
        </div>
      </div>
      {value.customMode ? (
        <FieldRow
          label="Custom category"
          htmlFor={`${idPrefix}-custom`}
          helperText="Use when no preset matches."
          className="min-w-0 gap-1.5"
        >
          <Input
            id={`${idPrefix}-custom`}
            quiet
            disabled={disabled}
            value={value.customText}
            maxLength={BOT_FIELD_MAX.categoryText}
            placeholder="e.g. real estate, internal IT"
            autoFocus
            onChange={(e) =>
              onChange({
                ...value,
                customText: e.target.value.slice(0, BOT_FIELD_MAX.categoryText),
              })
            }
          />
        </FieldRow>
      ) : null}
      {error ? (
        <p className="m-0 text-[0.75rem] leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
