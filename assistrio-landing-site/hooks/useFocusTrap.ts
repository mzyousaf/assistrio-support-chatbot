"use client";

import { useEffect, type RefObject } from "react";

function isHiddenForA11y(el: HTMLElement): boolean {
  if (el.closest('[aria-hidden="true"]')) return true;
  return false;
}

/** Visible, tabbable descendants inside `root` in document order. */
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"),
  );
  return nodes.filter((el) => {
    if (isHiddenForA11y(el)) return false;
    if (el.hasAttribute("disabled")) return false;
    if ((el as HTMLInputElement).type === "hidden") return false;
    return el.tabIndex >= 0;
  });
}

/**
 * Keeps Tab / Shift+Tab cycling inside `containerRef` while `active`.
 * Pair with initial focus on open and focus restore on close at the caller.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    if (!root) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const current = containerRef.current;
      if (!current) return;
      const list = getFocusableElements(current);
      if (list.length === 0) return;

      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || (activeEl && !current.contains(activeEl))) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef]);
}
