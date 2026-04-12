import { AgentWorkspaceDataLoader } from "@/components/admin/agent-workspace/AgentWorkspaceDataLoader";

export default function UserBotWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AgentWorkspaceDataLoader>{children}</AgentWorkspaceDataLoader>;
}
