import type { ChatLauncherWhenOpen } from "../models/botChatUI";

/** Coerces API/persisted values to the canonical launcher “when open” mode. */
export function normalizeLauncherWhenOpen(raw: unknown): ChatLauncherWhenOpen {
  const s = String(raw ?? "chevron-down")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (s === "close" || s === "x") return "close";
  if (s === "same" || s === "launcher" || s === "keep") return "same";
  if (
    s === "chevron-down" ||
    s === "chevrondown" ||
    s === "arrow-down" ||
    s === "minimize" ||
    s === "down"
  ) {
    return "chevron-down";
  }
  return "chevron-down";
}
