import type { BotDocumentItem } from "@/components/admin/BotDocumentsManager";
import { normalizeVisitorMultiChatMax } from "@/lib/visitorMultiChatMax";
import type { BotChatUI, BotLeadCaptureV2 } from "@/models/Bot";

export type DocRow = {
  _id: string;
  title?: string;
  sourceType?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  status?: string;
  error?: string;
  ingestedAt?: string;
  hasText?: boolean;
  textLength?: number;
  createdAt?: string;
};

export type Health = {
  docsTotal?: number;
  docsQueued?: number;
  docsProcessing?: number;
  docsReady?: number;
  docsFailed?: number;
  lastIngestedAt?: string;
  lastFailedDoc?: { docId?: string; title?: string; error?: string; updatedAt?: string };
};

/** Map API documents to BotForm document items. */
export function mapDocumentsToBotItems(documents: DocRow[]): BotDocumentItem[] {
  return documents.map((doc) => {
    const s = doc.status;
    const status: BotDocumentItem["status"] =
      s === "queued" || s === "processing" || s === "ready" || s === "failed" ? s : undefined;
    return {
      _id: String(doc._id),
      title: String(doc.title ?? ""),
      sourceType: String(doc.sourceType ?? ""),
      fileName: doc.fileName ?? undefined,
      fileType: doc.fileType ?? undefined,
      fileSize: doc.fileSize,
      url: doc.url ?? undefined,
      status,
      error: doc.error ?? undefined,
      ingestedAt: doc.ingestedAt ?? undefined,
      hasText: Boolean(doc.hasText),
      textLength: Number(doc.textLength) || 0,
      createdAt: doc.createdAt ?? undefined,
    };
  });
}

/** Build `initialBot` for EditBotFormClient from loaded bot + documents + health. */
export function buildInitialBotPayload(
  bot: Record<string, unknown>,
  documents: DocRow[],
  health: Health | undefined,
): Record<string, unknown> {
  const docsMapped = mapDocumentsToBotItems(documents);
  const botName = String(bot.name ?? "Bot");
  const botImageUrl = typeof bot.imageUrl === "string" ? bot.imageUrl : undefined;
  const status: "draft" | "published" = (bot.status as string) === "published" ? "published" : "draft";

  return {
    id: String(bot.id ?? bot._id),
    name: botName,
    shortDescription: (bot.shortDescription as string) || undefined,
    description: (bot.description as string) || undefined,
    category: (bot.category as string) || undefined,
    categories: (Array.isArray(bot.categories) ? bot.categories : []) as string[],
    imageUrl: botImageUrl,
    avatarEmoji: typeof bot.avatarEmoji === "string" ? bot.avatarEmoji : undefined,
    openaiApiKeyOverride: (bot.openaiApiKeyOverride as string) || undefined,
    whisperApiKeyOverride: (bot.whisperApiKeyOverride as string) || undefined,
    welcomeMessage: (bot.welcomeMessage as string) || undefined,
    knowledgeDescription: (bot.knowledgeDescription as string) || undefined,
    status,
    faqs: (Array.isArray(bot.faqs)
      ? (bot.faqs as Array<{ question?: unknown; answer?: unknown }>).map((faq) => ({
          question: String(faq?.question ?? ""),
          answer: String(faq?.answer ?? ""),
        }))
      : []) as { question: string; answer: string }[],
    exampleQuestions: Array.isArray(bot.exampleQuestions)
      ? (bot.exampleQuestions as string[]).map((q) => String(q ?? "").trim()).filter(Boolean)
      : [],
    documents: docsMapped,
    health: health
      ? {
          docsTotal: health.docsTotal ?? 0,
          docsQueued: health.docsQueued ?? 0,
          docsProcessing: health.docsProcessing ?? 0,
          docsReady: health.docsReady ?? 0,
          docsFailed: health.docsFailed ?? 0,
          lastIngestedAt: health.lastIngestedAt,
          lastFailedDoc: health.lastFailedDoc
            ? {
                docId: health.lastFailedDoc.docId ?? "",
                title: health.lastFailedDoc.title ?? "",
                error: health.lastFailedDoc.error,
                updatedAt: health.lastFailedDoc.updatedAt,
              }
            : undefined,
        }
      : {
          docsTotal: documents.length,
          docsQueued: 0,
          docsProcessing: 0,
          docsReady: 0,
          docsFailed: 0,
          lastIngestedAt: undefined,
          lastFailedDoc: undefined,
        },
    isPublic: Boolean(bot.isPublic),
    visibility:
      bot.visibility === "private" || bot.visibility === "public"
        ? (bot.visibility as "public" | "private")
        : "public",
    accessKey: typeof bot.accessKey === "string" ? bot.accessKey : "",
    secretKey: typeof bot.secretKey === "string" ? bot.secretKey : "",
    creatorType: (bot.creatorType === "visitor" ? "visitor" : "user") as "user" | "visitor",
    ownerVisitorId: typeof bot.ownerVisitorId === "string" ? bot.ownerVisitorId : undefined,
    messageLimitMode:
      (bot.messageLimitMode === "fixed_total" ? "fixed_total" : "none") as "none" | "fixed_total",
    messageLimitTotal: typeof bot.messageLimitTotal === "number" ? bot.messageLimitTotal : null,
    messageLimitUpgradeMessage:
      typeof bot.messageLimitUpgradeMessage === "string" ? bot.messageLimitUpgradeMessage : null,
    visitorMultiChatEnabled: (bot as { visitorMultiChatEnabled?: boolean }).visitorMultiChatEnabled === true,
    visitorMultiChatMax: normalizeVisitorMultiChatMax(
      (bot as { visitorMultiChatMax?: unknown }).visitorMultiChatMax,
    ),
    allowedDomains: Array.isArray((bot as { allowedDomains?: unknown }).allowedDomains)
      ? ((bot as { allowedDomains: unknown[] }).allowedDomains as unknown[])
          .map((d) => String(d ?? "").trim())
          .filter(Boolean)
      : [],
    includeNameInKnowledge: Boolean((bot as { includeNameInKnowledge?: boolean }).includeNameInKnowledge),
    includeTaglineInKnowledge: Boolean((bot as { includeTaglineInKnowledge?: boolean }).includeTaglineInKnowledge),
    leadCapture: (bot.leadCapture as BotLeadCaptureV2 | undefined) ?? undefined,
    chatUI: (bot.chatUI as BotChatUI | undefined) ?? undefined,
    personality: (bot.personality as object) ?? {},
    config: (bot.config as object) ?? {},
  };
}
