import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';

export type FollowingSubNavIndicator = { top: number; height: number };

const INDICATOR_TRANSITION = 'top 250ms cubic-bezier(0.4,0,0.2,1), height 250ms cubic-bezier(0.4,0,0.2,1)';

function measureIndicator(
  track: HTMLDivElement,
  el: HTMLElement,
): FollowingSubNavIndicator {
  const trackRect = track.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return { top: elRect.top - trackRect.top + 2, height: elRect.height - 4 };
}

/** Positions a sliding teal bar on the active subnav item (customer dashboard pattern). */
export function useFollowingSubNavIndicator(
  activeIndex: number,
  deps: unknown[] = [],
): {
  trackRef: RefObject<HTMLDivElement | null>;
  setItemRef: (index: number) => (el: HTMLElement | null) => void;
  indicator: FollowingSubNavIndicator | null;
} {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [indicator, setIndicator] = useState<FollowingSubNavIndicator | null>(null);

  const setItemRef = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    };
  }, []);

  useEffect(() => {
    if (activeIndex < 0) {
      setIndicator(null);
      return;
    }
    const el = itemRefs.current[activeIndex];
    const track = trackRef.current;
    if (el && track) {
      setIndicator(measureIndicator(track, el));
    } else {
      setIndicator(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies remeasure deps
  }, [activeIndex, ...deps]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || activeIndex < 0) return;
    const ro = new ResizeObserver(() => {
      const el = itemRefs.current[activeIndex];
      if (el) setIndicator(measureIndicator(track, el));
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, [activeIndex]);

  return { trackRef, setItemRef, indicator };
}

type TrackProps = {
  className?: string;
  trackRef: RefObject<HTMLDivElement | null>;
  indicator: FollowingSubNavIndicator | null;
  children: ReactNode;
};

export function FollowingSubNavTrack({ className, trackRef, indicator, children }: TrackProps) {
  return (
    <div ref={trackRef} className={cn('relative ml-4 mt-1 flex flex-col gap-1 pb-1 pl-3', className)}>
      <div
        className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full"
        style={{ background: 'var(--border-soft)' }}
        aria-hidden
      />
      {indicator ? (
        <div
          className="absolute left-0 w-0.5 rounded-full bg-teal-500"
          style={{
            top: indicator.top,
            height: indicator.height,
            transition: INDICATOR_TRANSITION,
          }}
          aria-hidden
        />
      ) : null}
      {children}
    </div>
  );
}
