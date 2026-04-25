/**
 * Default floating + inline (contained) chat panel sizes. Clamped to viewport / host on small screens.
 */
export const PANEL_COLLAPSED_WIDTH_PX = 404;
export const PANEL_COLLAPSED_HEIGHT_PX = 730;
export const PANEL_EXPANDED_WIDTH_PX = 560;
/** Upper cap for expanded height when using viewport ratio (px). */
export const PANEL_EXPANDED_HEIGHT_MAX_PX = 900;
/** Fraction of viewport height used for expanded floating panel (before other clamps). */
export const PANEL_EXPANDED_VIEWPORT_HEIGHT_RATIO = 0.85;

/** Matches `ChatLauncherBubble` default and `ChatWithLauncher` launcher offset math. */
export const LAUNCHER_EDGE_INSET_PX = 16;
export const PANEL_ABOVE_LAUNCHER_GAP_PX = 12;
const HORIZONTAL_VIEW_MARGIN_PX = 20;
const TOP_VIEW_MARGIN_PX = 16;

export function defaultLauncherDiameterPx(launcherSize?: number): number {
  return typeof launcherSize === "number" && Number.isFinite(launcherSize) && launcherSize > 0
    ? launcherSize
    : 48;
}

export function floatingLauncherBottomInsetPx(launcherSize?: number): number {
  return LAUNCHER_EDGE_INSET_PX + defaultLauncherDiameterPx(launcherSize) + PANEL_ABOVE_LAUNCHER_GAP_PX;
}

/**
 * Pixels the decorative contained launcher is shifted **down** with `bottom: -N` in
 * `ContainedLauncherPreview`. Must match that component so the host can shrink the panel and avoid
 * vertical overflow when the launcher size grows past 48px.
 */
const CONTAINED_PREVIEW_BASE_BOTTOM_OUTSET_PX = 50;
const CONTAINED_PREVIEW_EXTRA_OUTSET_PER_PX_ABOVE_48 = 0.7;

export function containedLauncherPreviewBottomOutsetPx(launcherSize?: number): number {
  const sizeForSpacing = Math.min(96, Math.max(32, Math.round(launcherSize ?? 48)));
  return (
    CONTAINED_PREVIEW_BASE_BOTTOM_OUTSET_PX +
    Math.max(0, sizeForSpacing - 48) * CONTAINED_PREVIEW_EXTRA_OUTSET_PER_PX_ABOVE_48
  );
}

export type PanelBox = { width: number; height: number };

function parseExpandedHeightPx(expandedHeight: number | string | undefined, vh: number): number {
  if (typeof expandedHeight === "string" && expandedHeight.trim().endsWith("vh")) {
    const n = parseFloat(expandedHeight);
    if (Number.isFinite(n)) return Math.min(PANEL_EXPANDED_HEIGHT_MAX_PX, Math.max(320, Math.round((n / 100) * vh)));
  }
  if (typeof expandedHeight === "number" && Number.isFinite(expandedHeight)) {
    return Math.min(PANEL_EXPANDED_HEIGHT_MAX_PX, Math.max(320, Math.round(expandedHeight)));
  }
  return Math.min(PANEL_EXPANDED_HEIGHT_MAX_PX, Math.max(320, Math.round(vh * PANEL_EXPANDED_VIEWPORT_HEIGHT_RATIO)));
}

/**
 * Floating embed: panel is `fixed` in the viewport. Reserve space for launcher + margins.
 */
export function computeFloatingPanelBox(
  vw: number,
  vh: number,
  launcherBottomInsetPx: number,
  isExpanded: boolean,
): PanelBox {
  const maxW = Math.max(280, vw - HORIZONTAL_VIEW_MARGIN_PX);
  const maxH = Math.max(320, vh - launcherBottomInsetPx - TOP_VIEW_MARGIN_PX);
  const collapsedW = Math.min(PANEL_COLLAPSED_WIDTH_PX, maxW);
  const collapsedH = Math.min(PANEL_COLLAPSED_HEIGHT_PX, maxH);
  if (!isExpanded) {
    return { width: collapsedW, height: collapsedH };
  }
  const targetExpandedW = Math.min(PANEL_EXPANDED_WIDTH_PX, maxW);
  const targetExpandedH = Math.min(
    Math.min(Math.round(vh * PANEL_EXPANDED_VIEWPORT_HEIGHT_RATIO), PANEL_EXPANDED_HEIGHT_MAX_PX),
    maxH,
  );
  return {
    width: Math.max(collapsedW, targetExpandedW),
    height: Math.max(collapsedH, targetExpandedH),
  };
}

export function floatingPanelCanMeaningfulExpand(
  vw: number,
  vh: number,
  launcherBottomInsetPx: number,
): boolean {
  const collapsed = computeFloatingPanelBox(vw, vh, launcherBottomInsetPx, false);
  const expanded = computeFloatingPanelBox(vw, vh, launcherBottomInsetPx, true);
  return expanded.width > collapsed.width + 2 || expanded.height > collapsed.height + 2;
}

/**
 * Contained / host-mounted preview: clamp to both host `ResizeObserver` box and the viewport
 * so the panel never exceeds the stage or the screen.
 */
export function computeContainedPanelBox(
  hostW: number,
  hostH: number,
  vw: number,
  vh: number,
  isExpanded: boolean,
  opts?: {
    collapsedWidth?: number;
    collapsedHeight?: number;
    expandedWidth?: number;
    expandedHeight?: number | string;
    /**
     * Space that extends **below** the panel (e.g. contained preview launcher with `bottom: -N`):
     * subtract from the host’s usable height so `panelHeight + reservedBottom` fits without scroll.
     */
    reservedBottomPx?: number;
  },
): PanelBox {
  const cw0 = typeof opts?.collapsedWidth === "number" && opts.collapsedWidth > 0
    ? opts.collapsedWidth
    : PANEL_COLLAPSED_WIDTH_PX;
  const ch0 = typeof opts?.collapsedHeight === "number" && opts.collapsedHeight > 0
    ? opts.collapsedHeight
    : PANEL_COLLAPSED_HEIGHT_PX;
  const ew0 = typeof opts?.expandedWidth === "number" && opts.expandedWidth > 0
    ? opts.expandedWidth
    : PANEL_EXPANDED_WIDTH_PX;
  const ehPixels = parseExpandedHeightPx(opts?.expandedHeight, vh);
  const reservedBottom =
    typeof opts?.reservedBottomPx === "number" && Number.isFinite(opts.reservedBottomPx) && opts.reservedBottomPx > 0
      ? opts.reservedBottomPx
      : 0;

  const availW = Math.max(200, Math.min(hostW, vw - 8));
  const rawAvailH = Math.min(hostH, vh - 8);
  const availH = Math.max(240, rawAvailH - reservedBottom);

  const collapsedW = Math.min(cw0, availW);
  const collapsedH = Math.min(ch0, availH);
  if (!isExpanded) {
    return { width: Math.round(collapsedW), height: Math.round(collapsedH) };
  }
  const expandedW = Math.min(ew0, availW);
  const expandedH = Math.min(ehPixels, availH);
  return {
    width: Math.round(Math.max(collapsedW, expandedW)),
    height: Math.round(Math.max(collapsedH, expandedH)),
  };
}

export function containedPanelCanMeaningfulExpand(
  hostW: number,
  hostH: number,
  vw: number,
  vh: number,
  opts?: {
    collapsedWidth?: number;
    collapsedHeight?: number;
    expandedWidth?: number;
    expandedHeight?: number | string;
    reservedBottomPx?: number;
  },
): boolean {
  const c = computeContainedPanelBox(hostW, hostH, vw, vh, false, opts);
  const e = computeContainedPanelBox(hostW, hostH, vw, vh, true, opts);
  return e.width > c.width + 2 || e.height > c.height + 2;
}
