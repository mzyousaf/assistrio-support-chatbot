import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import {
  computeContainedPanelBox,
  computeFloatingPanelBox,
  containedPanelCanMeaningfulExpand,
  floatingLauncherBottomInsetPx,
  floatingPanelCanMeaningfulExpand,
} from "../lib/embedPanelConstraints";
import type { PanelBox } from "../lib/embedPanelConstraints";

function useViewportSize(): { vw: number; vh: number } {
  const [s, setS] = useState(() =>
    typeof window !== "undefined"
      ? { vw: window.innerWidth, vh: window.innerHeight }
      : { vw: 1280, vh: 800 },
  );
  useEffect(() => {
    const onResize = () => setS({ vw: window.innerWidth, vh: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return s;
}

/**
 * Prefer a full-bleed measure target when present (e.g. `[data-widget-preview-measure]`), then
 * `[data-widget-preview-portal-surface]`, so contained panels size to the **available** preview area
 * while the portal surface can be shrink-wrapped and centered. Without this, a shrink-wrapped
 * surface is circular: hostH tracks the panel, not the column.
 */
function useHostBox(ref: React.RefObject<HTMLElement | null>, enabled: boolean): { w: number; h: number } {
  const [box, setBox] = useState({ w: 10_000, h: 10_000 });
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const target =
      el.closest("[data-widget-preview-measure]") ??
      el.closest("[data-widget-preview-portal-surface]") ??
      el.parentElement?.parentElement ??
      el.parentElement ??
      el;
    const ro = new ResizeObserver(() => {
      const r = target.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(target);
    const r0 = target.getBoundingClientRect();
    setBox({ w: r0.width, h: r0.height });
    return () => ro.disconnect();
  }, [ref, enabled]);
  return box;
}

export type ContainedSizeOpts = {
  collapsedWidth?: number;
  collapsedHeight?: number;
  expandedWidth?: number;
  expandedHeight?: number | string;
  reservedBottomPx?: number;
};

/**
 * Resolves clampled panel width/height for both floating (fixed + launcher inset) and contained
 * (host + viewport) presentations. `canExpand` hides the expand affordance when there is no extra room.
 */
export function useChatPanelBox(
  useFloating: boolean,
  isExpanded: boolean,
  launcherSize: number | undefined,
  containerRef: React.RefObject<HTMLDivElement | null>,
  containedOpts: ContainedSizeOpts,
): { box: PanelBox; canExpand: boolean } {
  const { vw, vh } = useViewportSize();
  const { w: hostW, h: hostH } = useHostBox(containerRef, !useFloating);
  return useMemo(() => {
    if (useFloating) {
      const inset = floatingLauncherBottomInsetPx(launcherSize);
      return {
        box: computeFloatingPanelBox(vw, vh, inset, isExpanded),
        canExpand: floatingPanelCanMeaningfulExpand(vw, vh, inset),
      };
    }
    return {
      box: computeContainedPanelBox(hostW, hostH, vw, vh, isExpanded, containedOpts),
      canExpand: containedPanelCanMeaningfulExpand(hostW, hostH, vw, vh, containedOpts),
    };
  }, [useFloating, vw, vh, isExpanded, launcherSize, hostW, hostH, containedOpts]);
}
