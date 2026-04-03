import { QUICK_LINK_ICON_IDS } from "@assistrio/chat-widget/quick-link-icons";

const ALLOWED = new Set<string>(QUICK_LINK_ICON_IDS as readonly string[]);

export function normalizeQuickLinkIcon(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  return ALLOWED.has(s) ? s : undefined;
}
