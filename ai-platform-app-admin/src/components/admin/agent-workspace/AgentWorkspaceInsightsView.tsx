"use client";

import { usePathname } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import { AgentSectionPlaceholder } from "@/components/admin/AgentSectionPlaceholder";
import { InsightsConversationsView } from "@/components/admin/agent-workspace/InsightsConversationsView";
import {
  getAgentSectionTitle,
  getAgentPlaceholderCopy,
} from "@/components/admin/agent-workspace-views";
import { EditBotWorkspaceLayout } from "@/components/admin/EditBotWorkspaceLayout";
import { AgentWorkspaceMainSkeleton } from "@/components/ui/Skeleton";
import { useAgentWorkspace } from "@/contexts/AgentWorkspaceContext";
import { useUser } from "@/hooks/useUser";

type Props = {
  /** Path after /bots/[id]/ for titles and placeholder copy (e.g. insights/conversations). */
  routeSlug: string;
};

export function AgentWorkspaceInsightsView({ routeSlug }: Props) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useUser();
  const { state, bot } = useAgentWorkspace();

  const slug = routeSlug.replace(/\/$/, "").trim();
  const botName = bot ? String(bot.name ?? "Agent") : "Agent";
  const sectionTitle = getAgentSectionTitle(slug);
  const placeholder = getAgentPlaceholderCopy(pathname, slug);

  if (authLoading || !user) {
    return (
      <AdminShell title="Agent" agentTitle={undefined} fullWidth showTitleRow={false}>
        <div className="flex min-h-0 flex-1 flex-col bg-[#f4fbfb] dark:bg-gray-950">
          <EditBotWorkspaceLayout>
            <AgentWorkspaceMainSkeleton />
          </EditBotWorkspaceLayout>
        </div>
      </AdminShell>
    );
  }

  if (state === "not-found") {
    return (
      <AdminShell title="Agent" agentTitle={undefined}>
        <p className="text-gray-700 dark:text-gray-300">Bot not found.</p>
      </AdminShell>
    );
  }

  if (state !== "ready" || !bot) {
    return (
      <AdminShell title="Agent" agentTitle={undefined} fullWidth showTitleRow={false}>
        <div className="flex min-h-0 flex-1 flex-col bg-[#f4fbfb] dark:bg-gray-950">
          <EditBotWorkspaceLayout>
            <AgentWorkspaceMainSkeleton />
          </EditBotWorkspaceLayout>
        </div>
      </AdminShell>
    );
  }

  if (slug === "insights/conversations") {
    return (
      <AdminShell title={sectionTitle} agentTitle={botName} fullWidth showTitleRow={false}>
        <div className="flex min-h-0 min-h-[calc(100dvh-7rem)] w-full max-w-none flex-1 flex-col bg-[#f4fbfb] -mx-4 sm:-mx-5 lg:-mx-7 dark:bg-gray-950">
          <EditBotWorkspaceLayout>
            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
              <InsightsConversationsView />
            </div>
          </EditBotWorkspaceLayout>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={sectionTitle} agentTitle={botName} fullWidth showTitleRow={false}>
      <div className="flex min-h-0 flex-1 flex-col bg-[#f4fbfb] dark:bg-gray-950">
        <EditBotWorkspaceLayout>
          <AgentSectionPlaceholder
            title={sectionTitle}
            description={placeholder.description}
            ctaHref={placeholder.cta?.href}
            ctaLabel={placeholder.cta?.label}
          />
        </EditBotWorkspaceLayout>
      </div>
    </AdminShell>
  );
}
