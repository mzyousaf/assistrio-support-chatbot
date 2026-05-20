import { useMemo, type CSSProperties } from "react";

import {
  containedLauncherPreviewBottomOutsetPx,
  containedLauncherPreviewDiameterPx,
} from "../lib/embedPanelConstraints";
import { launcherBubbleFromChatUI } from "../lib/launcherBubbleFromChatUI";
import { normalizeLauncherIcon } from "../lib/launcherIconNormalize";
import type { BotChatUI } from "../models/botChatUI";

const BASE_OVERLAY: Pick<CSSProperties, "position" | "left" | "top" | "right" | "bottom" | "zIndex" | "pointerEvents"> = {
  position: "absolute",
  left: "auto",
  top: "auto",
  zIndex: 200,
  pointerEvents: "none",
};

/**
 * Decorative launcher bubble for `presentation: "contained"` when the real floating launcher is off.
 * Anchored to the card’s bottom-right; sits **under** the panel. Hosts should reserve bottom space
 * (e.g. padding) so `overflow: auto` preview columns do not clip the hang. Bottom outsets are
 * defined in `containedLauncherPreviewBottomOutsetPx` and subtracted in `computeContainedPanelBox`
 * as `reservedBottomPx` so the panel shrinks as the launcher grows.
 */
export function ContainedLauncherPreview({
  chatUI,
  avatarUrl,
  avatarEmoji,
  primaryColor,
}: {
  chatUI?: BotChatUI;
  avatarUrl?: string;
  avatarEmoji?: string;
  primaryColor: string;
}) {
  const bubble = useMemo(
    () => launcherBubbleFromChatUI(chatUI, avatarUrl, avatarEmoji),
    [chatUI, avatarUrl, avatarEmoji],
  );
  const icon = normalizeLauncherIcon(chatUI?.launcherIcon);
  const diameter = containedLauncherPreviewDiameterPx(bubble.size);
  const bottomOutsetPx = containedLauncherPreviewBottomOutsetPx(bubble.size);
  const overlayStyle: CSSProperties = {
    ...BASE_OVERLAY,
    right: 0,
    bottom: `-${bottomOutsetPx}px`,
  };
  const backgroundColor = icon === "default" || icon === "custom" ? primaryColor : "#0f172a";

  return (
    <div
      style={overlayStyle}
      className="assistrio-contained-launcher-preview"
      data-contained-launcher-preview
      aria-hidden
    >
      <div
        className="overflow-hidden rounded-full shadow-md ring-2 ring-white/90"
        style={{ width: diameter, height: diameter, backgroundColor }}
      >
        <div className="h-full w-full overflow-hidden rounded-full">{bubble.avatar}</div>
      </div>
    </div>
  );
}
