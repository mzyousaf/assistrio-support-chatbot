import { describe, expect, it } from "vitest";

import {
  CONTAINED_STAGE_EDGE_INSET_PX,
  CONTAINED_STAGE_SIZING_INSET_PX,
  containedPanelAboveLauncherAnchorStyle,
  containedPanelCanMeaningfulExpand,
  containedWidgetAnchorStyle,
  computeContainedPanelBox,
  LIVE_WIDGET_COLLAPSED_HEIGHT_MAX_PX,
  LIVE_WIDGET_EXPANDED_WIDTH_MAX_PX,
  PANEL_COLLAPSED_WIDTH_PX,
} from "./embedPanelConstraints";

describe("contained widget anchor styles", () => {
  it("anchors launcher and panel to bottom-right with stage edge inset", () => {
    expect(containedWidgetAnchorStyle("bottom-right")).toEqual({
      bottom: CONTAINED_STAGE_EDGE_INSET_PX,
      right: CONTAINED_STAGE_EDGE_INSET_PX,
      top: "auto",
      left: "auto",
    });
  });

  it("anchors bottom-left corner with stage edge inset", () => {
    expect(containedWidgetAnchorStyle("bottom-left")).toEqual({
      bottom: CONTAINED_STAGE_EDGE_INSET_PX,
      left: CONTAINED_STAGE_EDGE_INSET_PX,
      top: "auto",
      right: "auto",
    });
  });

  it("does not use top positioning for default bottom-right anchor", () => {
    const style = containedWidgetAnchorStyle("bottom-right");
    expect(style.top).toBe("auto");
    expect(typeof style.bottom).toBe("number");
    expect(typeof style.right).toBe("number");
  });
});

describe("live-widget stage sizing inside large preview canvas", () => {
  const vw = 1440;
  const vh = 900;
  const hostW = 820;
  const hostH = 800;

  const stageOpts = {
    collapsedWidth: PANEL_COLLAPSED_WIDTH_PX,
    collapsedHeightMaxPx: LIVE_WIDGET_COLLAPSED_HEIGHT_MAX_PX,
    expandedWidthMaxPx: LIVE_WIDGET_EXPANDED_WIDTH_MAX_PX,
    expandedHeight: "75vh",
    stageSizingInsetPx: CONTAINED_STAGE_SIZING_INSET_PX,
    fillHost: false,
  } as const;

  it("keeps normal collapsed panel width on a large canvas", () => {
    const collapsed = computeContainedPanelBox(hostW, hostH, vw, vh, false, stageOpts);
    expect(collapsed.width).toBe(PANEL_COLLAPSED_WIDTH_PX);
    expect(collapsed.height).toBe(LIVE_WIDGET_COLLAPSED_HEIGHT_MAX_PX);
  });

  it("expanded panel uses width cap and standard chat-widget expanded height", () => {
    const expanded = computeContainedPanelBox(hostW, hostH, vw, vh, true, stageOpts);
    const availH =
      Math.max(240, Math.min(hostH, vh - 8) - CONTAINED_STAGE_SIZING_INSET_PX / 2 - CONTAINED_STAGE_SIZING_INSET_PX / 2);
    const expectedExpandedH = Math.min(Math.min(900, Math.max(320, Math.round(vh * 0.75))), availH);

    expect(expanded.width).toBe(LIVE_WIDGET_EXPANDED_WIDTH_MAX_PX);
    expect(expanded.height).toBe(Math.max(LIVE_WIDGET_COLLAPSED_HEIGHT_MAX_PX, expectedExpandedH));
  });

  it("allows expand when stage is large enough", () => {
    expect(containedPanelCanMeaningfulExpand(hostW, hostH, vw, vh, stageOpts)).toBe(true);
  });

  it("preserves bottom-right anchor inset constant", () => {
    expect(CONTAINED_STAGE_EDGE_INSET_PX).toBe(24);
    expect(CONTAINED_STAGE_SIZING_INSET_PX).toBe(48);
  });

  it("lifts open panel above launcher with gap in contained mode", () => {
    const launcherBottom = containedWidgetAnchorStyle("bottom-right");
    const panelBottom = containedPanelAboveLauncherAnchorStyle("bottom-right", 40);
    expect(launcherBottom.bottom).toBe(24);
    expect(panelBottom.bottom).toBeGreaterThan(Number(launcherBottom.bottom));
    expect(panelBottom.bottom).toBe(24 + 40 + 12);
  });
});
