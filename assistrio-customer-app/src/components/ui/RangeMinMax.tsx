import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import styles from './RangeMinMax.module.css';

export type RangeMinMaxProps = {
  id?: string;
  label: string;
  labelTooltip?: ReactNode;
  min: number;
  max: number;
  step?: number;
  low: number;
  high: number;
  onLowChange: (value: number) => void;
  onHighChange: (value: number) => void;
  formatLowLabel?: (value: number) => string;
  formatHighLabel?: (value: number) => string;
  hint?: ReactNode;
  /** When true, omit the title row — use beside an external `<Label>` in a flex row. */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
};

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

function snapToStep(n: number, min: number, max: number, step: number): number {
  const s = step > 0 ? step : 1;
  const stepped = Math.round(n / s) * s;
  return clamp(stepped, min, max);
}

/** Must match `.slider::-webkit-slider-thumb` / `::-moz-range-thumb` width in `RangeMinMax.module.css`. */
const THUMB_SIZE_PX = 14;

function ratio(value: number, minV: number, maxV: number): number {
  if (maxV === minV) return 0;
  return (value - minV) / (maxV - minV);
}

/**
 * Horizontal position of thumb center (same geometry as native range inputs):
 * center = thumbHalf + ratio * (100% - thumbSize).
 */
function thumbCenterLeftCalc(t: number): string {
  const half = THUMB_SIZE_PX / 2;
  return `calc(${half}px + (100% - ${THUMB_SIZE_PX}px) * ${t})`;
}

/**
 * A min–max variant: two stacked native ranges with a single teal segment between thumbs.
 * Value badges anchored on each knob: low starts at thumb center→right; high ends at thumb center←left.
 */
export function RangeMinMax({
  id: idProp,
  label,
  labelTooltip,
  min,
  max,
  step = 1,
  low,
  high,
  onLowChange,
  onHighChange,
  formatLowLabel = (v) => String(Math.round(v)),
  formatHighLabel = (v) => String(Math.round(v)),
  hint,
  disabled,
  className,
  hideLabel = false,
}: RangeMinMaxProps) {
  const autoId = useId();
  const baseId = idProp ?? autoId;
  const labelId = `${baseId}-label`;
  const hintId = `${baseId}-hint`;

  const lowSnapped = snapToStep(low, min, max, step);
  const highSnapped = snapToStep(high, min, max, step);
  const lowSafe = Math.min(lowSnapped, highSnapped);
  const highSafe = Math.max(lowSnapped, highSnapped);

  const lowRef = useRef(lowSafe);
  const highRef = useRef(highSafe);
  lowRef.current = lowSafe;
  highRef.current = highSafe;

  const [active, setActive] = useState<'low' | 'high' | null>(null);

  useEffect(() => {
    const clear = () => setActive(null);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, []);

  const tLow = ratio(lowSafe, min, max);
  const tHigh = ratio(highSafe, min, max);

  /** Teal segment matches thumb-centers (naive % of full width draws past the knobs). */
  const fillStyle = {
    left: thumbCenterLeftCalc(tLow),
    width: `calc(max(0px, (100% - ${THUMB_SIZE_PX}px) * (${tHigh - tLow})))`,
  } as CSSProperties;

  /** Labels anchor on each knob: low grows right from thumb center; high grows left (ends at thumb center). */
  const labelLowStyle = {
    left: thumbCenterLeftCalc(tLow),
    transform: 'translateX(0)',
  } as CSSProperties;

  const labelHighStyle = {
    left: thumbCenterLeftCalc(tHigh),
    transform: 'translateX(-100%)',
  } as CSSProperties;

  const thumbsCoincide = lowSafe === highSafe;
  const zLow = thumbsCoincide
    ? active === 'high'
      ? 28
      : 38
    : active === 'low'
      ? 32
      : active === 'high'
        ? 22
        : 26;
  const zHigh = thumbsCoincide
    ? active === 'low'
      ? 28
      : 30
    : active === 'high'
      ? 32
      : active === 'low'
        ? 22
        : 28;

  /**
   * Both native sliders use the full span. Constraining max/min per input caused the browser
   * to clamp the sibling thumb when the other changed, firing a spurious change (linked movement).
   * Ordering is enforced only in commit + parent state.
   */
  const commitLow = (raw: string) => {
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n)) return;
    const upper = Math.min(highRef.current, max);
    const v = snapToStep(n, min, Math.max(min, upper), step);
    onLowChange(v);
  };

  const commitHigh = (raw: string) => {
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n)) return;
    const lower = Math.max(lowRef.current, min);
    const v = snapToStep(n, lower, max, step);
    onHighChange(v);
  };

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        hideLabel ? 'gap-0' : 'gap-1',
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

      <div className={cn('min-w-0', hideLabel ? 'pt-0' : 'pt-1')}>
        {/* Room for descenders; h-4 + truncate clips g,y,p,q */}
        <div className="relative mb-0 min-h-[1.25rem] w-full overflow-visible px-2 pb-0.5" aria-hidden>
          <span
            className="pointer-events-none absolute top-0 z-10 max-w-[min(9rem,calc(50%-12px))] whitespace-nowrap text-left text-[0.6875rem] font-normal leading-tight tabular-nums text-slate-800"
            style={labelLowStyle}
          >
            {formatLowLabel(lowSafe)}
          </span>
          <span
            className="pointer-events-none absolute top-0 z-[11] max-w-[min(9rem,calc(50%-12px))] whitespace-nowrap text-right text-[0.6875rem] font-normal leading-tight tabular-nums text-slate-800"
            style={labelHighStyle}
          >
            {formatHighLabel(highSafe)}
          </span>
        </div>

        <div className={cn(styles.trackShell, 'min-w-0 -mt-1')}>
          <div className={styles.trackBg} />
          <div className={styles.trackFill} style={fillStyle} />
          <input
            id={`${baseId}-low`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={lowSafe}
            disabled={disabled}
            onChange={(e) => commitLow(e.target.value)}
            aria-label={hideLabel ? `${label}, minimum` : 'Minimum'}
            aria-labelledby={hideLabel ? undefined : labelId}
            aria-describedby={!hideLabel && hint ? hintId : undefined}
            onPointerDown={() => setActive('low')}
            className={styles.slider}
            style={{ zIndex: zLow }}
          />
          <input
            id={`${baseId}-high`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={highSafe}
            disabled={disabled}
            onChange={(e) => commitHigh(e.target.value)}
            aria-label={hideLabel ? `${label}, maximum` : 'Maximum'}
            aria-labelledby={hideLabel ? undefined : labelId}
            aria-describedby={!hideLabel && hint ? hintId : undefined}
            onPointerDown={() => setActive('high')}
            className={styles.slider}
            style={{ zIndex: zHigh }}
          />
        </div>
      </div>
    </div>
  );
}
