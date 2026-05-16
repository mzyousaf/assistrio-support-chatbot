import type { ChatShadowIntensity } from "../../models/botChatUI";

/** Semantic classes defined in embed.css — Tailwind arbitrary shadow-* values were not emitted in the widget CSS build. */
const SHADOW_CLASS: Record<ChatShadowIntensity, string> = {
  none: "assistrio-chat-shadow-none",
  low: "assistrio-chat-shadow-low",
  medium: "assistrio-chat-shadow-medium",
  high: "assistrio-chat-shadow-high",
};

/** Panel / launcher shadow from `chatUI.shadowIntensity` (default medium). */
export function chatShadowIntensityClass(intensity: ChatShadowIntensity | undefined): string {
  const v = intensity ?? "medium";
  return SHADOW_CLASS[v] ?? SHADOW_CLASS.medium;
}
