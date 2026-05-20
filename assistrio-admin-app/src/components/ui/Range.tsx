import { useCallback, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './Input';
import { Tooltip } from './Tooltip';
import styles from './Range.module.css';

/** Must match `.slider::-webkit-slider-thumb` width in `Range.module.css`. */
const THUMB_SIZE_PX = 14;

/** When thumb is past this track ratio [0–1], pin trailing edge (`translateX(-100%)`) so labels stay inside narrow columns near max. */
const TRACK_BADGES_LABEL_ANCHOR_RIGHT_T = 0.52;

function ratio(value: number, minV: number, maxV: number): number {
  if (maxV === minV) return 0;
  return (value - minV) / (maxV - minV);
}

/** Thumb center horizontal position matching native `<input type="range">` geometry (see `RangeMinMax`). */
function thumbCenterLeftCalc(t: number): string {
  const half = THUMB_SIZE_PX / 2;
  return `calc(${half}px + (100% - ${THUMB_SIZE_PX}px) * ${t})`;
}

export type RangeVariant = 'default' | 'trackBadges' | 'sliderOnly';

export type RangeProps = {
  /** Stable id for label / controls; generated when omitted. */
  id?: string;
  label: string;
  /** Rich hint shown next to the label (info icon). */
  labelTooltip?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  /** Muted text under the label (same role as FieldRow helper). */
  hint?: ReactNode;
  /** Shown beside the numeric input when `variant` is `default` (ignored for `trackBadges`). */
  valueSuffix?: string;
  /** When true, omit the title row — use beside an external `<Label>` in a flex row. */
  hideLabel?: boolean;
  /** `trackBadges`: value chip follows the thumb; `sliderOnly`: slider without value UI. */
  variant?: RangeVariant;
  /** When `variant` is `trackBadges`, text shown above the snapped value (`formatTrackValue(value)`). */
  formatTrackValue?: (value: number) => string;
  /** When `variant` is `trackBadges`, set false to hide the thumb label (slider only). Default true. */
  showTrackValue?: boolean;
  disabled?: boolean;
  className?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function snapToStep(n: number, min: number, max: number, step: number): number {
  const s = step > 0 ? step : 1;
  const stepped = Math.round(n / s) * s;
  return clamp(stepped, min, max);
}

function formatSteppedValue(value: number, step: number): string {
  if (!Number.isFinite(value)) return '';
  const s = step > 0 ? step : 1;
  const snapped = Math.round(value / s) * s;
  if (s >= 1) return String(Math.round(snapped));
  const decimals = (s.toString().split('.')[1] ?? '').length;
  if (decimals <= 0) return String(Math.round(snapped));
  return snapped.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Default: teal-filled native range + synced numeric `Input`.
 * `variant="trackBadges"`: value follows the thumb; anchored from the knob inward; flips toward max so text stays inside; slider only.
 * `variant="sliderOnly"`: slider without numeric input or thumb label.
 */
export function Range({
  id: idProp,
  label,
  labelTooltip,
  value,
  min,
  max,
  step = 1,
  onValueChange,
  hint,
  valueSuffix,
  hideLabel = false,
  variant = 'default',
  formatTrackValue = (v) => String(Math.round(v)),
  showTrackValue = true,
  disabled,
  className,
}: RangeProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const sliderId = `${id}-slider`;
  const numberId = `${id}-number`;

  const snapped = snapToStep(value, min, max, step);
  const fillPct =
    max === min ? 0 : ((snapped - min) / (max - min)) * 100;

  const useTrackBadges = variant === 'trackBadges' && showTrackValue;
  const sliderOnly = variant === 'sliderOnly' || (variant === 'trackBadges' && !showTrackValue);
  const trackKnobLabelText = useTrackBadges ? formatTrackValue(snapped) : null;
  const thumbT = useTrackBadges ? ratio(snapped, min, max) : 0;
  const trackBadgeAnchorRight = useTrackBadges && thumbT >= TRACK_BADGES_LABEL_ANCHOR_RIGHT_T;
  const knobLabelStyle =
    useTrackBadges
      ? ({
          left: thumbCenterLeftCalc(thumbT),
          transform: trackBadgeAnchorRight ? 'translateX(-100%)' : 'translateX(0)',
        } satisfies CSSProperties)
      : null;

  const [numberFocused, setNumberFocused] = useState(false);
  const [numberText, setNumberText] = useState(() => formatSteppedValue(snapped, step));

  useEffect(() => {
    if (variant !== 'default') return;
    if (!numberFocused) setNumberText(formatSteppedValue(snapped, step));
  }, [snapped, step, numberFocused, variant]);

  const commitFromSlider = useCallback(
    (raw: string) => {
      const n = parseFloat(raw);
      if (Number.isNaN(n)) return;
      onValueChange(snapToStep(n, min, max, step));
    },
    [max, min, onValueChange, step],
  );

  const commitFromInputString = useCallback(
    (raw: string) => {
      const t = raw.trim().replace(',', '.');
      if (t === '' || t === '-') return;
      const n = parseFloat(t);
      if (Number.isNaN(n)) return;
      onValueChange(snapToStep(n, min, max, step));
    },
    [max, min, onValueChange, step],
  );

  const sliderStyle = {
    '--range-fill': `${fillPct}%`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        hideLabel ? 'gap-0' : 'gap-1.5',
        disabled && 'opacity-[0.72]',
        className,
      )}
    >
      {hideLabel ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <span id={labelId} className="text-sm font-medium leading-tight text-slate-900">
            {label}
          </span>
          {labelTooltip ? (
            <Tooltip
              content={labelTooltip}
              panelClassName="max-w-[min(22rem,calc(100vw-24px))] px-2.5 py-2 font-normal"
              className="shrink-0"
            >
              <button
                type="button"
                className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                aria-label={`About ${label}`}
              >
                <Info size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </Tooltip>
          ) : null}
        </div>
      )}
      {hideLabel || !hint ? null : (
        <p id={hintId} className="m-0 text-[0.75rem] leading-snug text-slate-500">
          {hint}
        </p>
      )}

      {useTrackBadges && trackKnobLabelText != null ? (
        <div className="min-w-0 overflow-x-clip px-px">
          <div className="min-w-0">
            <div className="relative mb-0 min-h-[1.25rem] w-full overflow-visible pb-0.5" aria-hidden>
              <span
                className={cn(
                  'pointer-events-none absolute top-0 max-w-[min(9rem,calc(100%-4px))] whitespace-nowrap text-[0.6875rem] font-normal leading-tight tabular-nums text-slate-800',
                  trackBadgeAnchorRight ? 'text-right' : 'text-left',
                )}
                style={knobLabelStyle ?? undefined}
              >
                {trackKnobLabelText}
              </span>
            </div>

            <div className="-mt-1 flex min-h-[1.75rem] min-w-0 items-center">
              <input
                id={sliderId}
                type="range"
                min={min}
                max={max}
                step={step}
                value={snapped}
                disabled={disabled}
                onChange={(e) => commitFromSlider(e.target.value)}
                aria-label={hideLabel ? `${label}: ${trackKnobLabelText}` : undefined}
                aria-labelledby={hideLabel ? undefined : labelId}
                aria-describedby={!hideLabel && hint ? hintId : undefined}
                style={sliderStyle}
                className={cn(
                  styles.slider,
                  'w-full min-w-0 accent-transparent [color-scheme:light]',
                )}
              />
            </div>
          </div>
        </div>
      ) : sliderOnly ? (
        <div className={cn('flex min-h-[1.75rem] min-w-0 items-center', !hideLabel && hint && 'pt-0.5')}>
          <input
            id={sliderId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={snapped}
            disabled={disabled}
            onChange={(e) => commitFromSlider(e.target.value)}
            aria-label={hideLabel ? label : undefined}
            aria-labelledby={hideLabel ? undefined : labelId}
            aria-describedby={!hideLabel && hint ? hintId : undefined}
            style={sliderStyle}
            className={cn(
              styles.slider,
              'w-full min-w-0 accent-transparent [color-scheme:light]',
            )}
          />
        </div>
      ) : (
        <div className={cn('flex min-h-[2rem] min-w-0 items-center gap-1.5', hideLabel ? 'pt-0' : undefined)}>
          <div className="flex min-h-[1.75rem] min-w-0 flex-1 items-center pr-0.5">
            <input
              id={sliderId}
              type="range"
              min={min}
              max={max}
              step={step}
              value={snapped}
              disabled={disabled}
              onChange={(e) => commitFromSlider(e.target.value)}
              aria-label={hideLabel ? label : undefined}
              aria-labelledby={hideLabel ? undefined : labelId}
              aria-describedby={!hideLabel && hint ? hintId : undefined}
              style={sliderStyle}
              className={cn(
                styles.slider,
                'w-full min-w-0 accent-transparent [color-scheme:light]',
              )}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Input
              id={numberId}
              type="number"
              inputSize="sm"
              quiet
              disabled={disabled}
              min={min}
              max={max}
              step={step}
              inputMode={step % 1 !== 0 ? 'decimal' : 'numeric'}
              value={numberText}
              onChange={(e) => {
                const v = e.target.value;
                setNumberText(v);
                commitFromInputString(v);
              }}
              onFocus={() => {
                setNumberFocused(true);
                setNumberText(formatSteppedValue(snapped, step));
              }}
              onBlur={() => {
                setNumberFocused(false);
                const t = numberText.trim().replace(',', '.');
                if (t === '' || t === '-') {
                  setNumberText(formatSteppedValue(snapped, step));
                  return;
                }
                const n = parseFloat(t);
                if (Number.isNaN(n)) {
                  setNumberText(formatSteppedValue(snapped, step));
                } else {
                  const next = snapToStep(n, min, max, step);
                  onValueChange(next);
                  setNumberText(formatSteppedValue(next, step));
                }
              }}
              className="tabular-nums text-right"
              wrapperClassName="w-[4.75rem] shrink-0"
            />
            {valueSuffix ? (
              <span className="shrink-0 text-[0.75rem] tabular-nums text-slate-500">{valueSuffix}</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
