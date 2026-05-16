"use client";

import type { FocusEvent } from "react";
import { useEffect, useRef, useState } from "react";

type Options = {
  /** Advance callback — e.g. `() => setPage((p) => (p + 1) % n)` */
  onAdvance: () => void;
  /** When true, no interval is scheduled */
  disabled: boolean;
  /** Ms between advances */
  intervalMs?: number;
  /**
   * When true, pause while hovering or when focus is inside the carousel region.
   * Default false — slides keep advancing whenever the document is visible (per user request).
   */
  pauseOnInteraction?: boolean;
};

/**
 * Autoplay carousel advance. By default runs on an interval while the tab is visible.
 * Pauses when `disabled` (e.g. prefers-reduced-motion) or when `pauseOnInteraction` and hover/focus.
 */
export function useCarouselAutoplay({
  onAdvance,
  disabled,
  intervalMs = 3200,
  pauseOnInteraction = false,
}: Options) {
  const [hoverPaused, setHoverPaused] = useState(false);
  const hoverPausedRef = useRef(false);
  hoverPausedRef.current = hoverPaused;

  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;

  useEffect(() => {
    if (disabled) return;

    const tick = () => {
      if (pauseOnInteraction && hoverPausedRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      onAdvanceRef.current();
    };

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [disabled, intervalMs, pauseOnInteraction]);

  const pauseProps = pauseOnInteraction
    ? ({
        onMouseEnter: () => setHoverPaused(true),
        onMouseLeave: () => setHoverPaused(false),
        onFocusCapture: () => setHoverPaused(true),
        onBlurCapture: (e: FocusEvent<HTMLElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoverPaused(false);
        },
      } as const)
    : ({} as const);

  return { pauseProps };
}
