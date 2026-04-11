/**
 * Trial agent workspace routes mirror `ai-platform-app` `agent-sidebar-nav.ts` paths
 * (segments after `/trial/dashboard/`).
 */

export type TrialAgentNavLeaf = {
  type: "link";
  label: string;
  /** Path after `/trial/dashboard/` */
  segment: string;
  upcoming?: boolean;
};

export type TrialAgentNavGroup = {
  type: "group";
  id: string;
  label: string;
  children: TrialAgentNavLeaf[];
};

export type TrialAgentNavHeading = {
  type: "heading";
  label: string;
};

export type TrialAgentNavNode = TrialAgentNavLeaf | TrialAgentNavGroup | TrialAgentNavHeading;

export const TRIAL_AGENT_PLAYGROUND_LINKS: TrialAgentNavNode[] = [
  { type: "link", label: "Profile", segment: "playground/profile" },
  { type: "link", label: "Behavior", segment: "playground/behavior" },
  {
    type: "group",
    id: "trial-playground-knowledge",
    label: "Knowledge",
    children: [
      { type: "link", label: "Notes", segment: "playground/knowledge/notes" },
      { type: "link", label: "FAQs", segment: "playground/knowledge/faqs" },
      { type: "link", label: "Documents", segment: "playground/knowledge/documents" },
    ],
  },
  { type: "link", label: "AI & Integrations", segment: "playground/ai" },
  { type: "link", label: "Chat", segment: "playground/chat" },
  { type: "link", label: "Appearance", segment: "playground/appearance" },
  { type: "link", label: "Publish", segment: "playground/publish" },
];

export const TRIAL_AGENT_INSIGHTS_NODES: TrialAgentNavNode[] = [
  { type: "link", label: "Conversations", segment: "insights/conversations" },
  { type: "link", label: "Leads", segment: "insights/leads" },
  {
    type: "group",
    id: "trial-insights-analytics",
    label: "Analytics",
    children: [
      { type: "link", label: "Chats", segment: "insights/analytics/chats" },
      { type: "link", label: "Topics", segment: "insights/analytics/topics" },
      { type: "link", label: "Sentiment", segment: "insights/analytics/sentiment" },
    ],
  },
];

export const TRIAL_AGENT_SIDEBAR_TREE: TrialAgentNavNode[] = [
  { type: "heading", label: "Playground" },
  ...TRIAL_AGENT_PLAYGROUND_LINKS,
  { type: "heading", label: "Insights" },
  ...TRIAL_AGENT_INSIGHTS_NODES,
];

const TRIAL_DASH = "/trial/dashboard";

/** Maps playground destination to setup step when the trial agent is not created yet. */
export function trialPreAgentHrefForSegment(segment: string): string {
  if (segment === "playground/profile") return `${TRIAL_DASH}/setup/profile`;
  if (segment === "playground/behavior") return `${TRIAL_DASH}/setup/describe-your-agent`;
  if (segment.startsWith("playground/knowledge")) return `${TRIAL_DASH}/setup/knowledge-base`;
  if (
    segment === "playground/ai" ||
    segment === "playground/chat" ||
    segment === "playground/appearance" ||
    segment === "playground/publish" ||
    segment.startsWith("insights/")
  ) {
    return `${TRIAL_DASH}/setup/go-live`;
  }
  return `${TRIAL_DASH}/setup/profile`;
}

const KNOWLEDGE_SEGMENT_HASH: Record<string, string> = {
  "playground/knowledge/notes": "#notes",
  "playground/knowledge/faqs": "#faqs",
  "playground/knowledge/documents": "#files",
};

export function trialWorkspaceHref(segment: string): string {
  const clean = segment.replace(/^\//, "");
  const base = `${TRIAL_DASH}/${clean}`;
  const hash = KNOWLEDGE_SEGMENT_HASH[clean];
  return hash ? `${base}${hash}` : base;
}

/** Sections that are real trial playground editors (not locked placeholders). */
export function trialSegmentIsPlaygroundEditor(segment: string): boolean {
  return (
    segment === "playground/profile" ||
    segment === "playground/behavior" ||
    segment === "playground/knowledge" ||
    segment.startsWith("playground/knowledge/")
  );
}

/** Locked in trial until upgrade — show placeholder page but keep nav visible. */
export function trialSegmentIsTrialLocked(segment: string): boolean {
  if (trialSegmentIsPlaygroundEditor(segment)) return false;
  return (
    segment === "playground/ai" ||
    segment === "playground/chat" ||
    segment === "playground/appearance" ||
    segment === "playground/publish" ||
    segment.startsWith("insights/")
  );
}
