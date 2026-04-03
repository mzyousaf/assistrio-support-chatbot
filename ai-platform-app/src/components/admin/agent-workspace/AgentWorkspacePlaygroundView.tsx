"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentProps } from "react";

import AdminShell from "@/components/admin/AdminShell";
import { getAgentSectionTitle } from "@/components/admin/agent-workspace-views";
import { getBotsBasePath } from "@/components/admin/admin-shell-config";
import { BotEditorPane } from "@/components/admin/BotEditorPane";
import EditBotFormClient from "@/components/admin/EditBotFormClient";
import { EditBotWorkspaceLayout } from "@/components/admin/EditBotWorkspaceLayout";
import { Card } from "@/components/ui/Card";
import { AgentWorkspaceMainSkeleton } from "@/components/ui/Skeleton";
import { useAgentWorkspace } from "@/contexts/AgentWorkspaceContext";
import { buildInitialBotPayload } from "@/lib/agent-workspace-initial-bot";
import { useUser } from "@/hooks/useUser";

const EDIT_BOT_FORM_ID = "edit-bot-form";

type Props = {
  /** Full route segment after /bots/[id]/ for BotForm (e.g. playground/profile, playground/ai). */
  workspaceSectionSlug: string;
};

export function AgentWorkspacePlaygroundView({ workspaceSectionSlug }: Props) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useUser();
  const { state, bot, health, documents, botType, botId } = useAgentWorkspace();
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const slug = workspaceSectionSlug.replace(/\/$/, "").trim();

  const initialBot = useMemo(() => {
    if (state !== "ready" || !bot) return null;
    return buildInitialBotPayload(bot, documents, health);
  }, [state, bot, documents, health]);

  const botName = bot ? String(bot.name ?? "Agent") : "Agent";
  const draftStatus: "draft" | "published" =
    bot && (bot.status as string) === "published" ? "published" : "draft";

  const sectionTitle = getAgentSectionTitle(slug);

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

  if (state !== "ready" || !bot || !initialBot) {
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
          <BotEditorPane
            sectionTitle={sectionTitle}
            status={draftStatus}
            unsaved={unsaved}
            saving={saving}
            formId={EDIT_BOT_FORM_ID}
            previewHref={undefined}
            saveMessage={saveMessage}
          >
            <EditBotFormClient
              workspaceSectionSlug={slug}
              formId={EDIT_BOT_FORM_ID}
              onDirtyChange={setUnsaved}
              onSavingChange={setSaving}
              onSaveSuccess={() => {
                setSaveMessage("Saved.");
                window.setTimeout(() => setSaveMessage(null), 4000);
              }}
              initialBot={initialBot as ComponentProps<typeof EditBotFormClient>["initialBot"]}
            />
          </BotEditorPane>
        </EditBotWorkspaceLayout>
      </div>
    </AdminShell>
  );
}
