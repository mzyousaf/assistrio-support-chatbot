/**
 * Maps agent workspace URL segments (after /bots/[id]/) to BotForm `EditorTabValue`.
 * Route-first: prefer `playground/*` and `insights/*` paths.
 */

export const EDITOR_TAB_VALUES = [
  "general",
  "behavior",
  "knowledge",
  "integrations",
  "chat-experience",
  "appearance",
  "publish",
] as const;

export type EditorTabValue = (typeof EDITOR_TAB_VALUES)[number];

export function isEditorTabValue(v: string): v is EditorTabValue {
  return (EDITOR_TAB_VALUES as readonly string[]).includes(v);
}

/** Strip optional `playground/` prefix for tab resolution. */
function normalizePlaygroundSlug(s: string): string {
  const t = s.replace(/\/$/, "").trim();
  if (t.startsWith("playground/")) return t.slice("playground/".length);
  return t;
}

/** Resolve URL slug → BotForm `Tabs` value. */
export function slugToEditorTab(slug: string): EditorTabValue {
  const raw = slug.replace(/\/$/, "").trim();
  const s = normalizePlaygroundSlug(raw);

  if (!s || s === "playground" || s === "profile") return "general";
  if (s === "behavior") return "behavior";
  if (s === "knowledge" || s.startsWith("knowledge/") || s === "sources/files") return "knowledge";
  if (s === "ai" || s === "integrations" || s === "settings/ai") return "integrations";
  if (s === "chat" || s === "settings/chat-interface") return "chat-experience";
  if (s === "appearance") return "appearance";
  if (s === "publish" || s === "deploy") return "publish";
  if (s === "activity/leads" || s === "insights/leads") return "behavior";
  return "general";
}

/** Primary path after /bots/[id]/ for each editor tab (route-based workspace). */
export function editorTabToSlug(tab: EditorTabValue): string {
  switch (tab) {
    case "general":
      return "playground/profile";
    case "behavior":
      return "playground/behavior";
    case "knowledge":
      return "playground/knowledge/notes";
    case "integrations":
      return "playground/ai";
    case "chat-experience":
      return "playground/chat";
    case "appearance":
      return "playground/appearance";
    case "publish":
      return "playground/publish";
    default:
      return "playground/profile";
  }
}

const PLAYGROUND_FULL_EDITOR = new Set([
  "playground/profile",
  "playground/behavior",
  "playground/knowledge",
  "playground/knowledge/notes",
  "playground/knowledge/faqs",
  "playground/knowledge/documents",
  "playground/ai",
  "playground/chat",
  "playground/appearance",
  "playground/publish",
]);

/** Legacy flat paths (pre–playground/ prefix) — still accepted via redirects. */
const LEGACY_FULL_EDITOR = new Set([
  "profile",
  "behavior",
  "knowledge",
  "integrations",
  "chat",
  "appearance",
  "publish",
  "sources/files",
  "deploy",
  "settings/general",
  "settings/ai",
  "settings/chat-interface",
  "activity/leads",
]);

/**
 * Slugs that mount the full `EditBotFormClient` / `BotForm`.
 * Other agent routes render placeholders or future Insights UIs.
 */
export function shouldShowFullEditor(slug: string): boolean {
  const s = slug.replace(/\/$/, "").trim();
  if (PLAYGROUND_FULL_EDITOR.has(s)) return true;
  if (LEGACY_FULL_EDITOR.has(s)) return true;
  if (s === "insights/leads") return true;
  return false;
}
