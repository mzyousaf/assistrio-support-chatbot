"use client";

import React from "react";
import { useRouter } from "next/navigation";

import BotForm from "@/components/admin/BotForm";
import type { BotDocumentItem } from "@/components/admin/BotDocumentsManager";
import type { BotFaq } from "@/components/admin/BotFaqsEditor";
import { apiFetch } from "@/lib/api";
import { clearDraftId, rotateDraftId } from "@/lib/draftBot";
import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotPersonality } from "@/models/Bot";

type EditBotFormClientProps = {
  formId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** Called when name, imageUrl, or chatUI change for live chat preview. */
  onLivePreviewChange?: (preview: { name: string; imageUrl?: string; chatUI: BotChatUI; tagline?: string; description?: string; welcomeMessage?: string }) => void;
  initialBot: {
    id?: string;
    name?: string;
    shortDescription?: string;
    description?: string;
    category?: string;
    categories?: string[];
    imageUrl?: string;
    welcomeMessage?: string;
    knowledgeDescription?: string;
    status?: "draft" | "published";
    faqs?: BotFaq[];
    exampleQuestions?: string[];
    documents?: BotDocumentItem[];
    openaiApiKeyOverride?: string;
    whisperApiKeyOverride?: string;
    isPublic?: boolean;
    leadCapture?: BotLeadCaptureV2;
    chatUI?: BotChatUI;
    personality?: BotPersonality;
    config?: BotConfig;
    health?: {
      docsTotal: number;
      docsQueued: number;
      docsProcessing: number;
      docsReady: number;
      docsFailed: number;
      lastIngestedAt?: string;
      lastFailedDoc?: {
        docId: string;
        title: string;
        error?: string;
        updatedAt?: string;
      };
    };
  };
};

export default function EditBotFormClient({
  initialBot,
  formId,
  onDirtyChange,
  onLivePreviewChange,
}: EditBotFormClientProps) {
  const router = useRouter();

  return (
    <BotForm
      mode="edit"
      formId={formId}
      onDirtyChange={onDirtyChange}
      onLivePreviewChange={onLivePreviewChange}
      initialBot={{
        ...initialBot,
        config: {
          temperature: initialBot.config?.temperature ?? 0.3,
          responseLength: initialBot.config?.responseLength ?? "medium",
          maxTokens: initialBot.config?.maxTokens,
        },
      }}
      onSubmit={async (payload) => {
        if (!initialBot.id) {
          throw new Error("Bot id is missing.");
        }
        const response = await apiFetch(`/api/super-admin/bots/${initialBot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const error = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(error.error || "Failed to update bot.");
        }
        if (payload.status === "published") {
          clearDraftId();
        }
        router.refresh();
      }}
      onCreateAnotherBot={() => {
        rotateDraftId();
        router.push("/super-admin/bots/new?new=1");
      }}
    />
  );
}
