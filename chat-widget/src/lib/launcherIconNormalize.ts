import type { ChatLauncherIcon } from "../models/botChatUI";

/**
 * Coerces persisted/API launcher icon values to the canonical union.
 * Handles whitespace, casing, underscores, and common legacy variants.
 */
export function normalizeLauncherIcon(raw: unknown): ChatLauncherIcon {
  const s = String(raw ?? "default")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (s === "bot-avatar" || s === "botavatar") return "bot-avatar";
  if (s === "custom") return "custom";
  return "default";
}
