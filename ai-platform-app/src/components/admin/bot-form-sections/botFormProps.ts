import type { BotDocumentItem } from "@/components/admin/BotDocumentsManager";
import type { BotFaq } from "@/components/admin/BotFaqsEditor";
import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotPersonality } from "@/models/Bot";

import type { BotFormSubmitPayload } from "./botFormSubmitPayload";

export interface BotFormProps {
  mode: "create" | "edit";
  initialBot?: {
    id?: string;
    name?: string;
    shortDescription?: string;
    description?: string;
    category?: string;
    categories?: string[];
    imageUrl?: string;
    avatarEmoji?: string;
    welcomeMessage?: string;
    knowledgeDescription?: string;
    status?: "draft" | "published";
    faqs?: BotFaq[];
    exampleQuestions?: string[];
    documents?: BotDocumentItem[];
    openaiApiKeyOverride?: string;
    whisperApiKeyOverride?: string;
    isPublic?: boolean;
    visibility?: "public" | "private";
    accessKey?: string;
    secretKey?: string;
    creatorType?: "user" | "visitor";
    ownerVisitorId?: string;
    messageLimitMode?: "none" | "fixed_total";
    messageLimitTotal?: number | null;
    messageLimitUpgradeMessage?: string | null;
    visitorMultiChatEnabled?: boolean;
    visitorMultiChatMax?: number | null;
    allowedDomains?: string[];
    includeNameInKnowledge?: boolean;
    includeTaglineInKnowledge?: boolean;
    includeNotesInKnowledge?: boolean;
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
  onSubmit: (payload: BotFormSubmitPayload) => Promise<void> | void;
  botId?: string;
  onRetryFaq?: (faqIndex: number) => Promise<void>;
  onRetryNote?: () => Promise<void>;
  onCreateAnotherBot?: () => void;
  submitting?: boolean;
  formId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  workspaceSectionSlug?: string;
}
