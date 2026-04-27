"use client";

import { usePathname } from "next/navigation";

import { BotEditEmbedPreview } from "@/components/admin/BotEditEmbedPreview";
import { useEmbedPreview } from "@/contexts/EmbedPreviewContext";
import { useAgentWorkspace } from "@/contexts/AgentWorkspaceContext";

/**
 * Playground-only live embed: not mounted on Insights / other sections so we do not
 * run preview `init` off-editor. A **new** `pathname` under `.../playground/...` remounts
 * the widget (key = bot + path) for a **clean thread** on each tab change—similar to
 * “new panel = clean” in tools like Chatbase.
 */
export function AgentWorkspaceEmbedPreviewHost() {
  const pathname = usePathname() ?? "";
  const { state, botId } = useAgentWorkspace();
  const { previewOverrides } = useEmbedPreview();
  const onPlayground = pathname.includes("/playground/");

  if (state !== "ready" || !botId || !previewOverrides) {
    return null;
  }

  if (!onPlayground) {
    return null;
  }

  return <BotEditEmbedPreview key={`${botId}::${pathname}`} botId={botId} previewOverrides={previewOverrides} />;
}
