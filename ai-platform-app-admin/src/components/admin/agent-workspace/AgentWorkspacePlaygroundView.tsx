"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentProps } from "react";

import AdminShell from "@/components/admin/AdminShell";
import { getAgentSectionTitle } from "@/components/admin/agent-workspace-views";
import { BotEditorPane } from "@/components/admin/BotEditorPane";
import EditBotFormClient from "@/components/admin/EditBotFormClient";
import { EditBotWorkspaceLayout } from "@/components/admin/EditBotWorkspaceLayout";
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
  const { state, bot, health, documents, botId } = useAgentWorkspace();
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
