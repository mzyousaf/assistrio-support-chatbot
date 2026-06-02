import { describe, expect, it } from "vitest";

import {
  computeContainedPanelBox,
  containedPanelCanMeaningfulExpand,
  CONTAINED_STAGE_EDGE_INSET_PX,
  PANEL_COLLAPSED_HEIGHT_PX,
  PANEL_COLLAPSED_WIDTH_PX,
  PANEL_EXPANDED_WIDTH_PX,
} from "./embedPanelConstraints";

describe("live-widget contained stage sizing", () => {
  const hostW = 560;
  const hostH = 760;
  const vw = 1280;
  const vh = 900;
  const stageEdgeInset = CONTAINED_STAGE_EDGE_INSET_PX;

  it("fillParent embedded-card mode disables expand", () => {
    expect(
      containedPanelCanMeaningfulExpand(hostW, hostH, vw, vh, {
        fillHost: true,
      }),
    ).toBe(false);
  });

  it("live-widget stage with launcher reserve allows meaningful expand", () => {
    const canExpand = containedPanelCanMeaningfulExpand(hostW, hostH, vw, vh, {
      collapsedWidth: PANEL_COLLAPSED_WIDTH_PX,
      collapsedHeight: PANEL_COLLAPSED_HEIGHT_PX,
      expandedWidth: PANEL_EXPANDED_WIDTH_PX,
      expandedHeight: "75vh",
      reservedBottomPx: stageEdgeInset,
      fillHost: false,
    });
    expect(canExpand).toBe(true);

    const collapsed = computeContainedPanelBox(hostW, hostH, vw, vh, false, {
      collapsedWidth: PANEL_COLLAPSED_WIDTH_PX,
      collapsedHeight: PANEL_COLLAPSED_HEIGHT_PX,
      expandedWidth: PANEL_EXPANDED_WIDTH_PX,
      expandedHeight: "75vh",
      reservedBottomPx: stageEdgeInset,
      fillHost: false,
    });
    const expanded = computeContainedPanelBox(hostW, hostH, vw, vh, true, {
      collapsedWidth: PANEL_COLLAPSED_WIDTH_PX,
      collapsedHeight: PANEL_COLLAPSED_HEIGHT_PX,
      expandedWidth: PANEL_EXPANDED_WIDTH_PX,
      expandedHeight: "75vh",
      reservedBottomPx: stageEdgeInset,
      fillHost: false,
    });
    expect(expanded.width).toBeGreaterThan(collapsed.width);
  });

  it("large website preview host keeps desktop panel width instead of squeezing", () => {
    const largeHostW = 680;
    const largeHostH = 720;

    const collapsed = computeContainedPanelBox(largeHostW, largeHostH, vw, vh, false, {
      collapsedWidth: PANEL_COLLAPSED_WIDTH_PX,
      collapsedHeight: 640,
      expandedWidth: PANEL_EXPANDED_WIDTH_PX,
      expandedHeight: 680,
      reservedBottomPx: stageEdgeInset,
      fillHost: false,
    });

    expect(collapsed.width).toBeGreaterThanOrEqual(400);
    expect(collapsed.width).toBe(PANEL_COLLAPSED_WIDTH_PX);
    expect(collapsed.height).toBeGreaterThanOrEqual(600);

    expect(
      containedPanelCanMeaningfulExpand(largeHostW, largeHostH, vw, vh, {
        collapsedWidth: PANEL_COLLAPSED_WIDTH_PX,
        collapsedHeight: 640,
        expandedWidth: PANEL_EXPANDED_WIDTH_PX,
        expandedHeight: 680,
        reservedBottomPx: stageEdgeInset,
        fillHost: false,
      }),
    ).toBe(true);
  });
});
