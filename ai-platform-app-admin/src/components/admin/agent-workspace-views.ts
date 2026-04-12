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
  if (pathname.startsWith("/super-admin")) return "/super-admin";
  return "/user";
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
        "A dedicated inbox for this agent’s conversations—search, transcripts, and handoff—will live here. You can review workspace-wide chat activity in analytics in the meantime.",
      cta:
        root === "/super-admin"
          ? { href: "/user/analytics/chats", label: "Open workspace chats" }
          : { href: `${root}/analytics/chats`, label: "Open workspace chats" },
    };
  }

  const isAnalyticsChats = s.startsWith("insights/analytics/chats") || s.startsWith("analytics/chats");
  if (isAnalyticsChats) {
    return {
      description:
        "Per-agent chat volume, response quality, and trends will surface here. Explore workspace-level analytics for a full account view.",
      cta:
        root === "/super-admin"
          ? { href: "/user/analytics/chats", label: "Workspace chats" }
          : { href: `${root}/analytics/chats`, label: "Workspace chats" },
    };
  }

  const isAnalyticsTopics = s.startsWith("insights/analytics/topics") || s.startsWith("analytics/topics");
  if (isAnalyticsTopics) {
    return {
      description:
        "Topic clusters and recurring themes for this agent will appear here once we wire agent-scoped analytics.",
      cta:
        root === "/super-admin"
          ? { href: "/user/analytics/topics", label: "Workspace topics" }
          : { href: `${root}/analytics/topics`, label: "Workspace topics" },
    };
  }

  const isAnalyticsSentiment = s.startsWith("insights/analytics/sentiment") || s.startsWith("analytics/sentiment");
  if (isAnalyticsSentiment) {
    return {
      description:
        "Sentiment and satisfaction signals for this agent’s conversations are on the roadmap.",
      cta:
        root === "/super-admin"
          ? { href: "/user/analytics/sentiment", label: "Workspace sentiment" }
          : { href: `${root}/analytics/sentiment`, label: "Workspace sentiment" },
    };
  }

  if (s.startsWith("analytics/")) {
    return {
      description: "This analytics view is under construction for the agent workspace.",
      cta:
        root === "/super-admin"
          ? { href: "/user/analytics", label: "Workspace analytics" }
          : { href: `${root}/analytics`, label: "Workspace analytics" },
    };
  }

  if (s.startsWith("insights/")) {
    return {
      description: "This Insights section is on the roadmap. Configure and tune your agent in Playground.",
      cta:
        root === "/super-admin"
          ? { href: "/user/analytics", label: "Workspace analytics" }
          : { href: `${root}/analytics`, label: "Workspace analytics" },
    };
  }

  if (s.startsWith("activity/") && s !== "activity/leads") {
    return {
      description: "This activity view is not available in the agent workspace yet.",
      cta:
        root === "/super-admin"
          ? { href: "/user/visitors", label: "Open visitors" }
          : { href: `${root}/visitors`, label: "Open visitors" },
    };
  }

  return {
    description:
      "This section is on the roadmap. Build and tune your agent in Playground, or return to your workspace.",
    cta: { href: getBotsBasePath(pathname), label: "All agents" },
  };
}
