import type { BotFaq } from "@/components/admin/BotFaqsEditor";
import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotPersonality } from "@/models/Bot";

export interface BotFormSubmitPayload {
  name: string;
  shortDescription?: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  avatarEmoji?: string;
  welcomeMessage?: string;
  knowledgeDescription?: string;
  faqs: BotFaq[];
  exampleQuestions?: string[];
  status?: "draft" | "published";
  isPublic?: boolean;
  leadCapture: BotLeadCaptureV2;
  chatUI: BotChatUI;
  personality: BotPersonality;
  config: BotConfig;
  openaiApiKeyOverride?: string;
  whisperApiKeyOverride?: string;
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge?: boolean;
  visibility?: "public" | "private";
  messageLimitMode?: "none" | "fixed_total";
  messageLimitTotal?: number | null;
  messageLimitUpgradeMessage?: string | null;
  allowedDomains?: string[];
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
}
