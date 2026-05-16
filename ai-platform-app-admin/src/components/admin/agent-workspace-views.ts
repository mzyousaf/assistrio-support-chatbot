import { getBotsBasePath } from "@/components/admin/admin-shell-config";

export { shouldShowFullEditor } from "@/lib/agent-slug-to-tab";

const SLUG_LABEL: Record<string, string> = {
  playground: "Playground",
  "playground/profile": "Profile",
  "playground/behavior": "Behavior",
  "playground/knowledge": "Notes",
  "playground/knowledge/notes": "Notes",
  "playground/knowledge/faqs": "FAQs",
  "playground/knowledge/documents": "Documents",
  "playground/ai": "AI & Integrations",
  "playground/chat": "Chat",
  "playground/appearance": "Appearance",
  "playground/publish": "Publish",
  profile: "Profile",
  behavior: "Behavior",
  knowledge: "Knowledge",
  integrations: "AI & Integrations",
  chat: "Chat",
  appearance: "Appearance",
  publish: "Publish",
  deploy: "Deploy",
  "sources/files": "Knowledge · Files",
  "activity/leads": "Leads",
  "insights/conversations": "Conversations",
  "insights/leads": "Leads",
  "insights/analytics/chats": "Analytics · Chats",
  "insights/analytics/topics": "Analytics · Topics",
  "insights/analytics/sentiment": "Analytics · Sentiment",
  "settings/general": "General",
  "settings/ai": "AI",
  "settings/chat-interface": "Chat interface",
  "analytics/chats": "Analytics · Chats",
  "analytics/topics": "Analytics · Topics",
  "analytics/sentiment": "Analytics · Sentiment",
};

/** Slug = path after /bots/[id]/ */
export function formatAgentPageTitle(slug: string, botName: string): string {
  const s = slug.replace(/\/$/, "").trim() || "playground/profile";
  const label = SLUG_LABEL[s] ?? slugToFallbackLabel(s);
  return botName ? `${botName} · ${label}` : label;
}

/** Section-only label for shell / editor chrome (agent name comes from breadcrumb + sidebar). */
export function getAgentSectionTitle(slug: string): string {
  const s = slug.replace(/\/$/, "").trim() || "playground/profile";
  return SLUG_LABEL[s] ?? slugToFallbackLabel(s);
}

function slugToFallbackLabel(slug: string): string {
  const tail = slug.split("/").pop() ?? slug;
  return tail.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function workspaceRoot(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/super-admin")) return "/admin";
  return "/admin";
}

export type AgentPlaceholderCopy = {
  description: string;
  cta?: { href: string; label: string };
};

/**
 * Rich copy for agent-only “Soon” routes. Playground routes use the full editor instead.
 */
export function getAgentPlaceholderCopy(pathname: string, slug: string): AgentPlaceholderCopy {
  const s = slug.replace(/\/$/, "").trim();
  const root = workspaceRoot(pathname);

  if (s.startsWith("insights/conversations")) {
    return {
      description:
        "A dedicated inbox for this bot’s conversations—search, transcripts, and handoff—will live here. Use global analytics for account-wide chat activity in the meantime.",
      cta: { href: `${root}/analytics/chats`, label: "Open global chats" },
    };
  }

  const isAnalyticsChats = s.startsWith("insights/analytics/chats") || s.startsWith("analytics/chats");
  if (isAnalyticsChats) {
    return {
      description:
        "Per-bot chat volume, response quality, and trends will surface here. Use global analytics for the full operator view.",
      cta: { href: `${root}/analytics/chats`, label: "Global chats" },
    };
  }

  const isAnalyticsTopics = s.startsWith("insights/analytics/topics") || s.startsWith("analytics/topics");
  if (isAnalyticsTopics) {
    return {
      description:
        "Topic clusters and recurring themes for this agent will appear here once we wire agent-scoped analytics.",
      cta: { href: `${root}/analytics/topics`, label: "Global topics" },
    };
  }

  const isAnalyticsSentiment = s.startsWith("insights/analytics/sentiment") || s.startsWith("analytics/sentiment");
  if (isAnalyticsSentiment) {
    return {
      description:
        "Sentiment and satisfaction signals for this agent’s conversations are on the roadmap.",
      cta: { href: `${root}/analytics/sentiment`, label: "Global sentiment" },
    };
  }

  if (s.startsWith("analytics/")) {
    return {
      description: "This analytics view is under construction for the agent workspace.",
      cta: { href: `${root}/analytics`, label: "Global analytics" },
    };
  }

  if (s.startsWith("insights/")) {
    return {
      description: "This Insights section is on the roadmap. Configure and tune the bot in Playground.",
      cta: { href: `${root}/analytics`, label: "Global analytics" },
    };
  }

  if (s.startsWith("activity/") && s !== "activity/leads") {
    return {
      description: "This activity view is not available in the bot editor yet.",
      cta: { href: `${root}/visitors`, label: "Visitors" },
    };
  }

  return {
    description:
      "This section is on the roadmap. Build and tune the bot in Playground, or return to the bot list.",
    cta: { href: getBotsBasePath(pathname), label: "All bots" },
  };
}
