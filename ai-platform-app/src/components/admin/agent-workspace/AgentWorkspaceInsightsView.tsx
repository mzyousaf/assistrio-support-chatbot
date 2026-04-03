"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import { AgentSectionPlaceholder } from "@/components/admin/AgentSectionPlaceholder";
import {
  getAgentSectionTitle,
  getAgentPlaceholderCopy,
} from "@/components/admin/agent-workspace-views";
import { getBotsBasePath } from "@/components/admin/admin-shell-config";
import { Card } from "@/components/ui/Card";
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
  const { state, bot, botType } = useAgentWorkspace();

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

  if (state === "not-showcase") {
    return (
      <AdminShell title="Agent" agentTitle={undefined}>
        <Card>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Editing is only available for showcase bots.
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Type: {botType}</p>
          <Link
            className="mt-4 inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            href={getBotsBasePath(pathname)}
          >
            Back to agents
          </Link>
        </Card>
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
