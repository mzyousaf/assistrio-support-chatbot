/**
 * Section labels aligned with `ai-platform-app` `agent-workspace-views.ts` (`getAgentSectionTitle`).
 */

const SLUG_LABEL: Record<string, string> = {
  playground: "Playground",
  profile: "Profile",
  behavior: "Behavior",
  knowledge: "Knowledge",
  ai: "AI & Integrations",
  chat: "Chat",
  appearance: "Appearance",
  publish: "Publish",
  "playground/profile": "Profile",
  "playground/behavior": "Behavior",
  "playground/knowledge": "Knowledge",
  "playground/knowledge/notes": "Notes",
  "playground/knowledge/faqs": "FAQs",
  "playground/knowledge/documents": "Documents",
  "playground/ai": "AI & Integrations",
  "playground/chat": "Chat",
  "playground/appearance": "Appearance",
  "playground/publish": "Publish",
  "insights/conversations": "Conversations",
  "insights/leads": "Leads",
  "insights/analytics/chats": "Analytics · Chats",
  "insights/analytics/topics": "Analytics · Topics",
  "insights/analytics/sentiment": "Analytics · Sentiment",
};

function slugToFallbackLabel(slug: string): string {
  const tail = slug.split("/").pop() ?? slug;
  return tail.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getAgentSectionTitle(slug: string): string {
  const s = slug.replace(/\/$/, "").trim() || "playground/profile";
  return SLUG_LABEL[s] ?? slugToFallbackLabel(s);
}
