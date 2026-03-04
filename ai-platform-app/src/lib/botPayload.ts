import { normalizeLeadCapture } from "@/lib/leadCapture";
import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotPersonality } from "@/models/Bot";

export type NormalizedFaq = { question: string; answer: string };

export type BotPayloadInput = {
  name?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  categories?: unknown;
  imageUrl?: unknown;
  knowledgeDescription?: unknown;
  faqs?: unknown;
  welcomeMessage?: unknown;
  leadCapture?: unknown;
  chatUI?: unknown;
  personality?: unknown;
  config?: unknown;
  openaiApiKeyOverride?: unknown;
  isPublic?: unknown;
  status?: unknown;
};

export type NormalizedBotPayload = {
  name: string;
  shortDescription?: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  knowledgeDescription?: string;
  faqs: NormalizedFaq[];
  welcomeMessage?: string;
  leadCapture?: BotLeadCaptureV2;
  chatUI?: BotChatUI;
  personality?: BotPersonality;
  config?: BotConfig;
  openaiApiKeyOverride?: string;
  isPublic: boolean;
  status?: "draft" | "published";
};

export function normalizeFaqs(input: unknown): NormalizedFaq[] {
  const parsed =
    typeof input === "string"
      ? (() => {
          try {
            return JSON.parse(input);
          } catch {
            return [];
          }
        })()
      : input;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => ({
      question: typeof item?.question === "string" ? item.question.trim() : "",
      answer: typeof item?.answer === "string" ? item.answer.trim() : "",
    }))
    .filter((item) => item.question && item.answer);
}

export function normalizeBotPayload(input: BotPayloadInput): NormalizedBotPayload {
  const rawName = String(input.name ?? "").trim();
  const shortDescription = String(input.shortDescription ?? "").trim();
  const description = String(input.description ?? "").trim();
  const categories = Array.isArray(input.categories)
    ? input.categories.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  const imageUrl = String(input.imageUrl ?? "").trim();
  const knowledgeDescription = String(input.knowledgeDescription ?? "").trim();
  const welcomeMessage = String(input.welcomeMessage ?? "").trim();
  const openaiApiKeyOverride = String(input.openaiApiKeyOverride ?? "").trim();
  const isPublic = input.isPublic !== false;
  const status =
    input.status === "draft" || input.status === "published"
      ? input.status
      : undefined;
  const faqs = normalizeFaqs(input.faqs);

  const leadCapture = normalizeLeadCapture(input.leadCapture);
  const chatUIInput = (input.chatUI ?? {}) as BotChatUI;
  const chatUI: BotChatUI = {
    primaryColor:
      typeof chatUIInput.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(chatUIInput.primaryColor.trim())
        ? chatUIInput.primaryColor.trim()
        : "#14B8A6",
    backgroundStyle:
      chatUIInput.backgroundStyle === "auto" ||
      chatUIInput.backgroundStyle === "light" ||
      chatUIInput.backgroundStyle === "dark"
        ? chatUIInput.backgroundStyle
        : "light",
    bubbleStyle:
      chatUIInput.bubbleStyle === "rounded" || chatUIInput.bubbleStyle === "squared"
        ? chatUIInput.bubbleStyle
        : "rounded",
    avatarStyle:
      chatUIInput.avatarStyle === "emoji" ||
      chatUIInput.avatarStyle === "image" ||
      chatUIInput.avatarStyle === "none"
        ? chatUIInput.avatarStyle
        : "emoji",
    launcherPosition:
      chatUIInput.launcherPosition === "bottom-left" || chatUIInput.launcherPosition === "bottom-right"
        ? chatUIInput.launcherPosition
        : "bottom-right",
    font:
      chatUIInput.font === "system" || chatUIInput.font === "inter" || chatUIInput.font === "poppins"
        ? chatUIInput.font
        : "inter",
    showBranding: chatUIInput.showBranding !== false,
  };

  const personalityInput = (input.personality ?? {}) as BotPersonality;
  const personalityCandidate: BotPersonality = {
    name:
      typeof personalityInput.name === "string" && personalityInput.name.trim()
        ? personalityInput.name.trim()
        : undefined,
    description:
      typeof personalityInput.description === "string" && personalityInput.description.trim()
        ? personalityInput.description.trim()
        : undefined,
    systemPrompt:
      typeof personalityInput.systemPrompt === "string" && personalityInput.systemPrompt.trim()
        ? personalityInput.systemPrompt.trim()
        : undefined,
    tone:
      personalityInput.tone === "friendly" ||
      personalityInput.tone === "formal" ||
      personalityInput.tone === "playful" ||
      personalityInput.tone === "technical"
        ? personalityInput.tone
        : undefined,
    language:
      typeof personalityInput.language === "string" && personalityInput.language.trim()
        ? personalityInput.language.trim()
        : undefined,
  };
  const personality = Object.values(personalityCandidate).some(Boolean)
    ? personalityCandidate
    : undefined;

  const configInput = (input.config ?? {}) as BotConfig;
  const configCandidate: BotConfig = {
    temperature:
      typeof configInput.temperature === "number" &&
      configInput.temperature >= 0 &&
      configInput.temperature <= 1
        ? configInput.temperature
        : undefined,
    maxTokens:
      typeof configInput.maxTokens === "number" && Number.isFinite(configInput.maxTokens)
        ? Math.max(1, Math.floor(configInput.maxTokens))
        : undefined,
    responseLength:
      configInput.responseLength === "short" ||
      configInput.responseLength === "medium" ||
      configInput.responseLength === "long"
        ? configInput.responseLength
        : undefined,
  };
  const config = Object.values(configCandidate).some((value) => value !== undefined)
    ? configCandidate
    : undefined;

  return {
    name: rawName,
    shortDescription: shortDescription || undefined,
    description: description || undefined,
    categories,
    imageUrl: imageUrl || undefined,
    knowledgeDescription: knowledgeDescription || undefined,
    faqs,
    welcomeMessage: welcomeMessage || undefined,
    leadCapture,
    chatUI,
    personality,
    config,
    openaiApiKeyOverride: openaiApiKeyOverride || undefined,
    isPublic,
    status,
  };
}
