import { useId, useMemo, useRef } from 'react';
import { Pipette } from 'lucide-react';
import {
  DEFAULT_PRIMARY_HEX,
  normalizePrimaryColor,
  readableTextOnPrimaryColor,
  sanitizePrimaryColorInput,
} from '@/lib/primaryColorNormalize';
import { cn } from '@/lib/utils';

/** Curated presets for quick brand color selection in onboarding. */
export const AGENT_BRAND_COLOR_PRESETS = [
  '#14B8A6',
  '#0EA5E9',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#F59E0B',
  '#22C55E',
  '#64748B',
] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  idPrefix?: string;
  className?: string;
};

function isSameColor(a: string, b: string): boolean {
  return normalizePrimaryColor(a) === normalizePrimaryColor(b);
}

export function AgentBrandColorField({ value, onChange, disabled, idPrefix = 'agent-brand', className }: Props) {
  const pickerId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const colorValue = normalizePrimaryColor(value || DEFAULT_PRIMARY_HEX);
  const presetMatch = AGENT_BRAND_COLOR_PRESETS.some((preset) => isSameColor(preset, colorValue));
  const hexTextColor = useMemo(() => readableTextOnPrimaryColor(colorValue), [colorValue]);

  return (
    <div className={cn('flex w-1/2 min-w-0 flex-col gap-1.5', className)}>
      <p className="m-0 text-[0.8125rem] font-medium text-slate-700">Brand color</p>

      <div
        className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-2.5"
        role="group"
        aria-label="Brand color"
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3">
          {AGENT_BRAND_COLOR_PRESETS.map((preset) => {
            const selected = isSameColor(preset, colorValue);
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                className={cn(
                  'm-0.5 size-4 shrink-0 rounded-full transition-all duration-150',
                  selected
                    ? 'ring-2 ring-teal-600 ring-offset-[3px] ring-offset-white'
                    : 'ring-1 ring-slate-200/90 hover:ring-slate-300',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
                style={{ backgroundColor: preset }}
                aria-label={`Use ${preset}`}
                aria-pressed={selected}
                onClick={() => onChange(normalizePrimaryColor(preset))}
              />
            );
          })}

          <button
            type="button"
            disabled={disabled}
            className={cn(
              'm-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed transition-colors duration-150',
              !presetMatch
                ? 'border-teal-600 bg-teal-50 text-teal-700 ring-2 ring-teal-600/20 ring-offset-[3px] ring-offset-white'
                : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            aria-label="Pick a custom color"
            aria-pressed={!presetMatch}
            onClick={() => pickerRef.current?.click()}
          >
            <Pipette className="size-3" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <label
          htmlFor={`${idPrefix}-hex`}
          className="block w-full overflow-hidden rounded-md"
          style={{
            backgroundColor: colorValue,
            color: hexTextColor,
          }}
        >
          <input
            id={`${idPrefix}-hex`}
            type="text"
            className={cn(
              'block h-8 w-full border-none bg-transparent px-3 font-mono text-[0.8125rem] font-medium tracking-wide outline-none',
              'placeholder:opacity-60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/35',
              disabled && 'cursor-not-allowed opacity-60',
            )}
            style={{
              color: hexTextColor,
              caretColor: hexTextColor,
            }}
            value={value || DEFAULT_PRIMARY_HEX}
            disabled={disabled}
            onChange={(e) => onChange(sanitizePrimaryColorInput(e.target.value))}
            onBlur={(e) => onChange(normalizePrimaryColor(e.target.value))}
            placeholder={DEFAULT_PRIMARY_HEX}
            autoComplete="off"
            spellCheck={false}
            aria-label="Brand color hex value"
          />
        </label>
      </div>

      <input
        ref={pickerRef}
        id={pickerId}
        type="color"
        value={colorValue}
        disabled={disabled}
        className="sr-only"
        aria-label="Custom brand color picker"
        onChange={(e) => onChange(normalizePrimaryColor(e.target.value))}
      />
    </div>
  );
}
