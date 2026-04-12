"use client";

import { BotEditEmbedPreview } from "@/components/admin/BotEditEmbedPreview";
import { useEmbedPreview } from "@/contexts/EmbedPreviewContext";
import { useAgentWorkspace } from "@/contexts/AgentWorkspaceContext";

/**
 * Lives in the bot workspace layout (not in each playground tab page) so the
 * preview widget stays mounted across Playground route changes — avoids
 * re-calling `/api/widget/preview/init` on every tab switch.
 */
export function AgentWorkspaceEmbedPreviewHost() {
  const { state, botId } = useAgentWorkspace();
  const { previewOverrides } = useEmbedPreview();

  if (state !== "ready" || !botId || !previewOverrides) {
    return null;
  }

  return <BotEditEmbedPreview botId={botId} previewOverrides={previewOverrides} />;
}
