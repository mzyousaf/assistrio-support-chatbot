import type { BotChatUI } from "../../models/botChatUI";

/** Outline around the main chat panel when `showChatBorder` and width &gt; 0. */
export function chatPanelOutlineStyle(
  showChatBorder: boolean,
  borderWidthPx: number,
  borderColor: BotChatUI["chatPanelBorderColor"] | undefined,
  accentColor: string,
  dark: boolean,
): { border: string } | Record<string, never> {
  if (!showChatBorder || borderWidthPx <= 0) return {};
  const accent = accentColor.trim() || "#6366f1";
  const mode = borderColor === "default" ? "default" : "primary";
  const solid =
    mode === "default"
      ? dark
        ? "rgba(148, 163, 184, 0.42)"
        : "rgba(15, 23, 42, 0.14)"
      : `${accent}99`;
  return { border: `${borderWidthPx}px solid ${solid}` };
}
