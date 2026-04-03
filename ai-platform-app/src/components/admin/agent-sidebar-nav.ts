/**
 * Agent workspace sidebar — paths after /bots/[id]/
 * Route-first: `playground/*` and `insights/*`.
 */

export type AgentNavLeaf = {
  type: "link";
  label: string;
  /** Path after /bots/[id]/ */
  path: string;
  upcoming?: boolean;
};

export type AgentNavGroup = {
  type: "group";
  id: string;
  label: string;
  children: AgentNavLeaf[];
};

export type AgentNavHeading = {
  type: "heading";
  label: string;
};

export type AgentNavNode = AgentNavLeaf | AgentNavGroup | AgentNavHeading;

export const AGENT_PLAYGROUND_LINKS: AgentNavNode[] = [
  { type: "link", label: "Profile", path: "playground/profile" },
  { type: "link", label: "Behavior", path: "playground/behavior" },
  {
    type: "group",
    id: "agent-playground-knowledge",
    label: "Knowledge",
    children: [
      { type: "link", label: "Notes", path: "playground/knowledge/notes" },
      { type: "link", label: "FAQs", path: "playground/knowledge/faqs" },
      { type: "link", label: "Documents", path: "playground/knowledge/documents" },
    ],
  },
  { type: "link", label: "AI & Integrations", path: "playground/ai" },
  { type: "link", label: "Chat", path: "playground/chat" },
  { type: "link", label: "Appearance", path: "playground/appearance" },
  { type: "link", label: "Publish", path: "playground/publish" },
];

export const AGENT_INSIGHTS_NODES: AgentNavNode[] = [
  { type: "link", label: "Conversations", path: "insights/conversations" },
  { type: "link", label: "Leads", path: "insights/leads" },
  {
    type: "group",
    id: "agent-insights-analytics",
    label: "Analytics",
    children: [
      { type: "link", label: "Chats", path: "insights/analytics/chats" },
      { type: "link", label: "Topics", path: "insights/analytics/topics" },
      { type: "link", label: "Sentiment", path: "insights/analytics/sentiment" },
    ],
  },
];

export const AGENT_SIDEBAR_TREE: AgentNavNode[] = [
  { type: "heading", label: "Playground" },
  ...AGENT_PLAYGROUND_LINKS,
  { type: "heading", label: "Insights" },
  ...AGENT_INSIGHTS_NODES,
];
