import { useEffect, useRef, startTransition } from "react";

const DEFAULT_DEBOUNCE_MS = 120;

/**
 * Pushes dirty state to the parent after a short pause so the shell/header does not
 * re-render on every keystroke.
 */
export function useDebouncedDirtyNotify(
  dirty: boolean,
  onDirtyChange: ((d: boolean) => void) | undefined,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!onDirtyChange) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      startTransition(() => {
        onDirtyChange(dirty);
      });
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, onDirtyChange, debounceMs]);
}
