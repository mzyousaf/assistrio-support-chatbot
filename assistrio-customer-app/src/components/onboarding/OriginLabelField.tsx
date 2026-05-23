import { useState } from 'react';
import { FieldRow, Input, Select } from '@/components/ui';

export const ORIGIN_LABEL_PRESETS = [
  'Marketing site',
  'Main website',
  'Landing page',
  'Web app',
  'Customer portal',
  'Partner portal',
  'Support site',
  'Help center',
  'Documentation',
  'Blog',
  'E-commerce store',
  'Checkout site',
  'Staging site',
  'Development site',
] as const;

const MAX_LABEL_LENGTH = 80;

function isPresetLabel(label: string): label is (typeof ORIGIN_LABEL_PRESETS)[number] {
  const trimmed = label.trim();
  return ORIGIN_LABEL_PRESETS.some((preset) => preset === trimmed);
}

type Props = {
  value: string;
  onChange: (label: string) => void;
  disabled?: boolean;
  idPrefix?: string;
  error?: string | null;
};

export function OriginLabelField({
  value,
  onChange,
  disabled,
  idPrefix = 'onb-go-live-label',
  error = null,
}: Props) {
  const trimmed = value.trim();
  const presetMatch = isPresetLabel(trimmed) ? trimmed : null;
  const [forceCustom, setForceCustom] = useState(false);

  const inCustomMode = forceCustom || Boolean(trimmed && !presetMatch);

  function handleSelectChange(next: string) {
    setForceCustom(false);
    onChange(next);
  }

  function startCustom() {
    setForceCustom(true);
    onChange('');
  }

  function usePresets() {
    setForceCustom(false);
    onChange('');
  }

  return (
    <FieldRow
      label="Label"
      htmlFor={inCustomMode ? `${idPrefix}-custom` : `${idPrefix}-select`}
      helperText="Optional — helps you recognize this site later."
      error={error}
    >
      <div className="flex flex-col gap-2.5">
        {inCustomMode ? (
          <>
            <Input
              id={`${idPrefix}-custom`}
              quiet
              disabled={disabled}
              value={value}
              maxLength={MAX_LABEL_LENGTH}
              placeholder="e.g. Partner portal, staging site"
              autoFocus={forceCustom && !trimmed}
              onChange={(e) => onChange(e.target.value.slice(0, MAX_LABEL_LENGTH))}
            />
            <button
              type="button"
              disabled={disabled}
              className="m-0 w-fit cursor-pointer border-none bg-transparent p-0 text-[0.8125rem] font-medium text-[var(--color-teal-700)] hover:text-[var(--color-teal-800)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              onClick={usePresets}
            >
              Choose from predefined labels
            </button>
          </>
        ) : (
          <>
            <Select
              id={`${idPrefix}-select`}
              quiet
              disabled={disabled}
              value={presetMatch ?? ''}
              onChange={(e) => handleSelectChange(e.target.value)}
            >
              <option value="">Select a label</option>
              {ORIGIN_LABEL_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </Select>
            <button
              type="button"
              disabled={disabled}
              className="m-0 w-fit cursor-pointer border-none bg-transparent p-0 text-[0.8125rem] font-medium text-[var(--color-teal-700)] hover:text-[var(--color-teal-800)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              onClick={startCustom}
            >
              Enter custom label
            </button>
          </>
        )}
      </div>
    </FieldRow>
  );
}
