import type { ChatOpenAnimation } from "../models/botChatUI";

/** Coerces API/persisted values to the canonical open animation union. */
export function normalizeChatOpenAnimation(raw: unknown): ChatOpenAnimation {
  const s = String(raw ?? "slide-up-fade")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (s === "fade") return "fade";
  if (s === "expand" || s === "scale") return "expand";
  if (s === "slide-up-fade" || s === "slideupfade" || s === "slide-up" || s === "slideup") {
    return "slide-up-fade";
  }
  return "slide-up-fade";
}
