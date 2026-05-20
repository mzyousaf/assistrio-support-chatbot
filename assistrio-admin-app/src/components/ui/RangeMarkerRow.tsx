import { type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Must match `.slider::-webkit-slider-thumb` width in `Range.module.css`. */
const THUMB_SIZE_PX = 14;

/** Thumb-center horizontal position (same geometry as native `<input type="range">`). */
function thumbCenterLeftCalc(t: number): string {
  const half = THUMB_SIZE_PX / 2;
  return `calc(${half}px + (100% - ${THUMB_SIZE_PX}px) * ${t})`;
}

export type RangeMarkerItem = {
  label: string;
  onSelect: () => void;
  active?: boolean;
  recommended?: boolean;
};

export type RangeMarkerRowProps = {
  markers: readonly RangeMarkerItem[];
  /** Horizontal position per marker along the track, 0 = start and 1 = end. */
  positions: readonly number[];
  className?: string;
};

/**
 * Preset labels under a range slider, aligned to thumb-center positions on the track.
 * First label is flush left; last is flush right; middles are centered on their positions.
 */
export function RangeMarkerRow({ markers, positions, className }: RangeMarkerRowProps) {
  return (
    <div className={cn('relative w-full min-h-[2.25rem]', className)} role="presentation">
      {markers.map((marker, i) => {
        const t = positions[i] ?? 0;
        const isFirst = i === 0;
        const isLast = i === markers.length - 1;
        const style: CSSProperties = {
          left: thumbCenterLeftCalc(t),
          transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
        };
        return (
          <div
            key={marker.label}
            className={cn(
              'absolute top-0 flex max-w-[min(7rem,46%)] flex-col gap-1',
              isFirst && 'items-start text-left',
              isLast && 'items-end text-right',
              !isFirst && !isLast && 'items-center text-center',
            )}
            style={style}
          >
            <button
              type="button"
              className={cn(
                'text-[0.625rem] font-medium underline-offset-2 hover:underline',
                marker.active ? 'text-teal-800' : 'text-slate-500 hover:text-slate-700',
              )}
              onClick={marker.onSelect}
            >
              {marker.label}
            </button>
            {marker.recommended ? (
              <span className="text-[0.5625rem] font-medium text-teal-700">Recommended</span>
            ) : (
              <span className="h-3.5" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
