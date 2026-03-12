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
  /** Called when save starts (true) or ends (false). */
  onSavingChange?: (saving: boolean) => void;
  /** Called after successful save with optional embeddingQueued. */
  onSaveSuccess?: (result: { embeddingQueued?: boolean }) => void;
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
    noteEmbeddingStatus?: string;
    noteEmbeddingUpdatedAt?: string;
    noteEmbeddingError?: string | null;
  };
};

export default function EditBotFormClient({
  initialBot,
  formId,
  onDirtyChange,
  onSavingChange,
  onSaveSuccess,
  onLivePreviewChange,
}: EditBotFormClientProps) {
  const router = useRouter();

  const botId = initialBot.id;

  const handleRetryFaq = async (faqIndex: number) => {
    if (!botId) return;
    const res = await apiFetch(`/api/super-admin/bots/${botId}/embed/retry-faq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faqIndex }),
    });
    if (res.ok) router.refresh();
  };

  const handleRetryNote = async () => {
    if (!botId) return;
    const res = await apiFetch(`/api/super-admin/bots/${botId}/embed/retry-note`, {
      method: "POST",
    });
    if (res.ok) router.refresh();
  };

  const handleBackfillEmbeddings = async () => {
    if (!botId) return;
    const res = await apiFetch(`/api/super-admin/bots/${botId}/embed/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchSize: 20 }),
    });
    if (res.ok) router.refresh();
  };

  return (
    <BotForm
      mode="edit"
      formId={formId}
      onDirtyChange={onDirtyChange}
      onSavingChange={onSavingChange}
      onLivePreviewChange={onLivePreviewChange}
      initialBot={{
        ...initialBot,
        config: {
          temperature: initialBot.config?.temperature ?? 0.3,
          responseLength: initialBot.config?.responseLength ?? "medium",
          maxTokens: initialBot.config?.maxTokens,
        },
      }}
      botId={botId}
      onRetryFaq={botId ? handleRetryFaq : undefined}
      onRetryNote={botId ? handleRetryNote : undefined}
      onBackfillEmbeddings={botId ? handleBackfillEmbeddings : undefined}
      onSubmit={async (payload) => {
        if (!initialBot.id) {
          throw new Error("Bot id is missing.");
        }
        onSavingChange?.(true);
        try {
          const response = await apiFetch(`/api/super-admin/bots/${initialBot.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            const error = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(error.error || "Failed to update bot.");
          }
          const data = (await response.json().catch(() => ({}))) as { embeddingQueued?: boolean };
          if (payload.status === "published") {
            clearDraftId();
          }
          onSaveSuccess?.({ embeddingQueued: data.embeddingQueued });
          router.refresh();
        } finally {
          onSavingChange?.(false);
        }
      }}
      onCreateAnotherBot={() => {
        rotateDraftId();
        router.push("/super-admin/bots/new?new=1");
      }}
    />
  );
}
