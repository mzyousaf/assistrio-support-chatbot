import { type RefObject, useEffect } from 'react';

/**
 * Closes any open `<details>` inside `containerRef` when the user presses down
 * outside those elements, or presses Escape (capture-phase pointerdown matches
 * datasheet row menus).
 */
export function useCloseOpenDetailsOnOutsidePress(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      const target = e.target as Node;
      const openList = root.querySelectorAll('details[open]');
      if (openList.length === 0) return;
      openList.forEach((d) => {
        if (!d.contains(target)) d.removeAttribute('open');
      });
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const root = containerRef.current;
      if (!root) return;
      root.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef]);
}
