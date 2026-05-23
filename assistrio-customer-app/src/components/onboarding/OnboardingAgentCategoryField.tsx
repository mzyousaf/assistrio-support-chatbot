import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { FieldRow, Input, SearchableSelect } from '@/components/ui';
import { BOT_FIELD_MAX } from '@/lib/botFieldLimits';
import { cn } from '@/lib/utils';
import {
  CATEGORY_OPTIONS,
  CUSTOM_CATEGORY_PILL,
  MAX_CATEGORY_PILLS,
  type AgentCategoryValue,
  toggleAgentCategoryPill,
} from '@/components/agent/categoryUtils';

type Props = {
  value: AgentCategoryValue;
  onChange: (next: AgentCategoryValue) => void;
  disabled?: boolean;
  idPrefix?: string;
};

function labelForValue(value: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

/**
 * Compact category picker for onboarding — selected tags + searchable add, no pill wall.
 */
export function OnboardingAgentCategoryField({ value, onChange, disabled, idPrefix = 'onb-cat' }: Props) {
  const [pickerValue, setPickerValue] = useState('');

  const categorySlotsUsed = value.customMode
    ? value.customText.trim()
      ? 1
      : 0
    : value.selectedPredefined.length;

  const availableOptions = useMemo(() => {
    const selected = new Set(value.selectedPredefined);
    return CATEGORY_OPTIONS.filter((c) => !selected.has(c.value)).map((c) => ({
      value: c.value,
      label: c.label,
    }));
  }, [value.selectedPredefined]);

  const atMax = !value.customMode && value.selectedPredefined.length >= MAX_CATEGORY_PILLS;

  const selectOptions = useMemo(() => {
    const placeholder = atMax
      ? 'Maximum categories selected'
      : availableOptions.length === 0
        ? 'All presets selected'
        : 'Add a category…';
    return [{ value: '', label: placeholder, disabled: true }, ...availableOptions];
  }, [atMax, availableOptions]);

  function onPickCategory(nextValue: string) {
    if (!nextValue || atMax || value.customMode) return;
    onChange(toggleAgentCategoryPill(value, nextValue));
    setPickerValue('');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[0.75rem] leading-snug text-[var(--color-text-secondary)]">
          Pick up to three presets, or enter a custom category.
        </p>
        <span className="rounded-md bg-[var(--ui-surface-muted)] px-1.5 py-0.5 text-xs font-medium tabular-nums text-[var(--color-text-muted)]">
          {categorySlotsUsed}/{MAX_CATEGORY_PILLS}
        </span>
      </div>

      {!value.customMode && value.selectedPredefined.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {value.selectedPredefined.map((cat) => (
            <li key={cat}>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] py-0.5 pl-2.5 pr-1 text-[0.75rem] font-medium text-[var(--color-teal-800)]">
                {labelForValue(cat)}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${labelForValue(cat)}`}
                  className="inline-flex size-5 items-center justify-center rounded-full border-none bg-transparent text-[var(--color-teal-700)] hover:bg-[var(--color-primary-soft)] disabled:opacity-50"
                  onClick={() => onChange(toggleAgentCategoryPill(value, cat))}
                >
                  <X className="size-3" strokeWidth={2.5} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!value.customMode ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <SearchableSelect
              id={`${idPrefix}-picker`}
              value={pickerValue}
              options={selectOptions}
              disabled={disabled || atMax || availableOptions.length === 0}
              searchPlaceholder="Search categories…"
              triggerClassName={cn(atMax && 'opacity-60')}
              onChange={(e) => {
                const v = e.target.value;
                setPickerValue(v);
                onPickCategory(v);
              }}
            />
          </div>
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-[0.75rem] font-medium text-[var(--color-teal-700)] underline-offset-2 hover:underline disabled:opacity-50"
            onClick={() => onChange(toggleAgentCategoryPill(value, CUSTOM_CATEGORY_PILL))}
          >
            Use custom category
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <FieldRow
            label="Custom category"
            htmlFor={`${idPrefix}-custom`}
            helperText="Use when no preset matches."
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
          <button
            type="button"
            disabled={disabled}
            className="self-start cursor-pointer border-none bg-transparent p-0 text-[0.75rem] font-medium text-[var(--color-teal-700)] underline-offset-2 hover:underline disabled:opacity-50"
            onClick={() =>
              onChange({
                selectedPredefined: [],
                customMode: false,
                customText: '',
              })
            }
          >
            Choose from presets instead
          </button>
        </div>
      )}
    </div>
  );
}
