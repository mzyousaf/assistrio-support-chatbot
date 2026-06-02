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

/** Bottom/right inset when a live widget floats inside a contained website-preview stage (px). */
export const CONTAINED_STAGE_EDGE_INSET_PX = 24;

/** Combined inset for live-widget panel sizing (top + bottom or left + right) inside a large stage. */
export const CONTAINED_STAGE_SIZING_INSET_PX = CONTAINED_STAGE_EDGE_INSET_PX * 2;

export const LIVE_WIDGET_COLLAPSED_HEIGHT_MIN_PX = 620;
export const LIVE_WIDGET_COLLAPSED_HEIGHT_MAX_PX = 720;
export const LIVE_WIDGET_EXPANDED_WIDTH_MAX_PX = 620;

export type WidgetAnchorCorner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export type WidgetAnchorCss = {
  bottom?: number | string;
  top?: number | string;
  left?: number | string;
  right?: number | string;
};

/** Absolute anchor for launcher/panel inside a `position: relative` preview stage. */
export function containedWidgetAnchorStyle(
  corner: WidgetAnchorCorner,
  edgeInsetPx: number = CONTAINED_STAGE_EDGE_INSET_PX,
): WidgetAnchorCss {
  switch (corner) {
    case "bottom-right":
      return { bottom: edgeInsetPx, right: edgeInsetPx, top: "auto", left: "auto" };
    case "bottom-left":
      return { bottom: edgeInsetPx, left: edgeInsetPx, top: "auto", right: "auto" };
    case "top-right":
      return { top: edgeInsetPx, right: edgeInsetPx, bottom: "auto", left: "auto" };
    case "top-left":
      return { top: edgeInsetPx, left: edgeInsetPx, bottom: "auto", right: "auto" };
  }
}

/** Bottom/top offset for the open panel so it sits above (or below) the launcher with a gap. */
export function containedLauncherStackInsetPx(
  launcherSize?: number,
  edgeInsetPx: number = CONTAINED_STAGE_EDGE_INSET_PX,
): number {
  return edgeInsetPx + defaultLauncherDiameterPx(launcherSize) + PANEL_ABOVE_LAUNCHER_GAP_PX;
}

/** Panel anchor in contained mode: same horizontal corner as launcher, lifted above the bubble. */
export function containedPanelAboveLauncherAnchorStyle(
  corner: WidgetAnchorCorner,
  launcherSize?: number,
  edgeInsetPx: number = CONTAINED_STAGE_EDGE_INSET_PX,
): WidgetAnchorCss {
  const base = containedWidgetAnchorStyle(corner, edgeInsetPx);
  const stackPx = containedLauncherStackInsetPx(launcherSize, edgeInsetPx);
  if (corner === "bottom-right" || corner === "bottom-left") {
    return { ...base, bottom: stackPx, top: "auto" };
  }
  return { ...base, top: stackPx, bottom: "auto" };
}
const HORIZONTAL_VIEW_MARGIN_PX = 20;
const TOP_VIEW_MARGIN_PX = 16;

/** Default floating launcher diameter when `chatUI.launcherSize` is unset (px). */
export const DEFAULT_LAUNCHER_DIAMETER_PX = 10;

/** Diameter when `ChatLauncherBubble` is used without `size` (px). Init loading shell matches this. */
export const CHAT_LAUNCHER_BUBBLE_DEFAULT_SIZE_PX = 40;

export function defaultLauncherDiameterPx(launcherSize?: number): number {
  return typeof launcherSize === "number" && Number.isFinite(launcherSize) && launcherSize > 0
    ? launcherSize
    : DEFAULT_LAUNCHER_DIAMETER_PX;
}

export function floatingLauncherBottomInsetPx(launcherSize?: number): number {
  return LAUNCHER_EDGE_INSET_PX + defaultLauncherDiameterPx(launcherSize) + PANEL_ABOVE_LAUNCHER_GAP_PX;
}

/** Visual gap between contained preview panel bottom and launcher top (`ContainedLauncherPreview`). */
export const CONTAINED_PREVIEW_LAUNCHER_GAP_PX = 8;

/** Decorative launcher diameter in workspace contained preview (px). */
export function containedLauncherPreviewDiameterPx(launcherSize?: number): number {
  const size = Math.min(
    96,
    Math.max(32, Math.round(launcherSize ?? DEFAULT_LAUNCHER_DIAMETER_PX)),
  );
  return Math.min(72, Math.max(24, Math.round(size * 0.85)));
}

/**
 * Pixels the decorative contained launcher is shifted **down** with `bottom: -N` in
 * `ContainedLauncherPreview`. Must match that component so the host can shrink the panel and avoid
 * vertical overflow when the launcher size grows.
 */
export function containedLauncherPreviewBottomOutsetPx(launcherSize?: number): number {
  return containedLauncherPreviewDiameterPx(launcherSize) + CONTAINED_PREVIEW_LAUNCHER_GAP_PX;
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
    /**
     * Live-widget website preview: size panel to measured stage minus this inset (typically 48px).
     * Collapsed height is capped by `collapsedHeightMaxPx`; expanded height follows `expandedHeight` (default 85vh / 75vh) capped at 900px.
     */
    stageSizingInsetPx?: number;
    collapsedHeightMinPx?: number;
    collapsedHeightMaxPx?: number;
    expandedWidthMaxPx?: number;
    /**
     * Assistrio-hosted `/iframe/:botId` and `/share/:slug`: size the panel to the measured host (no default
     * px caps or viewport margins). Does not apply to dashboard preview or script embed launcher.
     */
    fillHost?: boolean;
  },
): PanelBox {
  const reservedBottomEarly =
    typeof opts?.reservedBottomPx === "number" && Number.isFinite(opts.reservedBottomPx) && opts.reservedBottomPx > 0
      ? opts.reservedBottomPx
      : 0;
  if (opts?.fillHost) {
    const availW = Math.max(200, hostW);
    const availH = Math.max(240, hostH - reservedBottomEarly);
    return { width: Math.round(availW), height: Math.round(availH) };
  }

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

  const stageSizingInset =
    typeof opts?.stageSizingInsetPx === "number" && Number.isFinite(opts.stageSizingInsetPx) && opts.stageSizingInsetPx > 0
      ? opts.stageSizingInsetPx
      : 0;
  if (stageSizingInset > 0) {
    const topInset = stageSizingInset / 2;
    const bottomInset = Math.max(topInset, reservedBottomEarly);
    const availW = Math.max(200, Math.min(hostW, vw - 8) - stageSizingInset);
    const availH = Math.max(240, Math.min(hostH, vh - 8) - topInset - bottomInset);
    const collapsedW = Math.min(cw0, availW);
    const collapsedMax = opts?.collapsedHeightMaxPx ?? LIVE_WIDGET_COLLAPSED_HEIGHT_MAX_PX;
    const collapsedH = Math.min(collapsedMax, availH);
    if (!isExpanded) {
      return { width: Math.round(collapsedW), height: Math.round(collapsedH) };
    }
    const expandedWCap = opts?.expandedWidthMaxPx ?? LIVE_WIDGET_EXPANDED_WIDTH_MAX_PX;
    const expandedW = Math.min(Math.max(collapsedW, expandedWCap), availW);
    const expandedH = Math.min(ehPixels, availH);
    return {
      width: Math.round(expandedW),
      height: Math.round(Math.max(collapsedH, expandedH)),
    };
  }

  const reservedBottom = reservedBottomEarly;

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
    stageSizingInsetPx?: number;
    collapsedHeightMinPx?: number;
    collapsedHeightMaxPx?: number;
    expandedWidthMaxPx?: number;
    fillHost?: boolean;
  },
): boolean {
  if (opts?.fillHost) return false;
  const c = computeContainedPanelBox(hostW, hostH, vw, vh, false, opts);
  const e = computeContainedPanelBox(hostW, hostH, vw, vh, true, opts);
  return e.width > c.width + 2 || e.height > c.height + 2;
}
