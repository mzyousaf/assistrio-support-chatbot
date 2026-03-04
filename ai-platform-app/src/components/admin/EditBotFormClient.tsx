"use client";

import React from "react";
import { useRouter } from "next/navigation";

import BotForm from "@/components/admin/BotForm";
import type { BotDocumentItem } from "@/components/admin/BotDocumentsManager";
import type { BotFaq } from "@/components/admin/BotFaqsEditor";
import { clearDraftId, rotateDraftId } from "@/lib/draftBot";
import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotPersonality } from "@/models/Bot";

type EditBotFormClientProps = {
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
    documents?: BotDocumentItem[];
    openaiApiKeyOverride?: string;
    isPublic?: boolean;
    leadCapture?: BotLeadCaptureV2;
    chatUI?: BotChatUI;
    personality?: BotPersonality;
    config?: BotConfig;
  };
};

export default function EditBotFormClient({ initialBot }: EditBotFormClientProps) {
  const router = useRouter();

  return (
    <BotForm
      mode="edit"
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
        const response = await fetch(`/api/super-admin/bots/${initialBot.id}`, {
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
