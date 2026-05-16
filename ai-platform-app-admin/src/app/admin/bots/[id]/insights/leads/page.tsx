import { AgentWorkspacePlaygroundView } from "@/components/admin/agent-workspace/AgentWorkspacePlaygroundView";

/** Leads continues to use the full editor (behavior / lead capture) until a dedicated Insights UI exists. */
export default function InsightsLeadsPage() {
  return <AgentWorkspacePlaygroundView workspaceSectionSlug="insights/leads" />;
}
