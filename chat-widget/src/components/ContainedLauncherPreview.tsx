import { useMemo, type CSSProperties } from "react";

import { launcherBubbleFromChatUI } from "../lib/launcherBubbleFromChatUI";
import { normalizeLauncherIcon } from "../lib/launcherIconNormalize";
import type { BotChatUI } from "../models/botChatUI";

/**
 * Slightly outside the stage box (sibling inner panel clips chat only). Negative inset mimics a
 * floating launcher hugging the panel edge; inline CSS avoids missing Tailwind utilities in embed CSS.
 */
const OVERLAY_STYLE: CSSProperties = {
  position: "absolute",
  left: "auto",
  top: "auto",
  right: "0px",
  bottom: "-50px",
  zIndex: 30,
  pointerEvents: "none",
};

/**
 * Decorative launcher bubble for `presentation: "contained"` when the real floating launcher is off.
 * Rendered on the **outer** contained stage (`overflow-visible`); inner panel clips `Chat` only.
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
  const size = bubble.size ?? 48;
  const diameter = Math.min(72, Math.max(40, Math.round(size * 0.85)));
  const backgroundColor = icon === "default" || icon === "custom" ? primaryColor : "#0f172a";

  return (
    <div
      style={OVERLAY_STYLE}
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
