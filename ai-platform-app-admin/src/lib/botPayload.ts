import { BOT_FIELD_MAX, clampStr } from "@/lib/botFieldLimits";
import { normalizeLeadCapture } from "@/lib/leadCapture";
import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotPersonality } from "@/models/Bot";
import type { ChatMenuQuickLink } from "@/models/Bot";
import { normalizeQuickLinkIcon } from "@/lib/quickLinkIconNormalize";

const MENU_QUICK_LINKS_MAX = 10;

function normalizeMenuQuickLinks(input: unknown): ChatMenuQuickLink[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MENU_QUICK_LINKS_MAX)
    .map((item: unknown) => {
      const o = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      if (!o) return null;
      const text = clampStr(typeof o.text === "string" ? String(o.text).trim() : "", BOT_FIELD_MAX.menuQuickLinkText);
      const route = clampStr(
        typeof o.route === "string" ? String(o.route).trim() : "",
        BOT_FIELD_MAX.menuQuickLinkRoute,
      );
      if (!text || !route) return null;
      const icon = normalizeQuickLinkIcon(o.icon);
      return icon ? { text, route, icon } : { text, route };
    })
    .filter((x): x is ChatMenuQuickLink => x != null);
}

export type NormalizedFaq = { question: string; answer: string; active?: boolean };

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
      active: item?.active === false ? false : true,
    }))
    .filter((item) => item.question && item.answer);
}

export function normalizeBotPayload(input: BotPayloadInput): NormalizedBotPayload {
  const rawName = clampStr(String(input.name ?? "").trim(), BOT_FIELD_MAX.name);
  const shortDescription = clampStr(String(input.shortDescription ?? "").trim(), BOT_FIELD_MAX.shortDescription);
  const description = clampStr(String(input.description ?? "").trim(), BOT_FIELD_MAX.description);
  const categories = Array.isArray(input.categories)
    ? input.categories
        .map((entry) => clampStr(String(entry).trim(), BOT_FIELD_MAX.categoryText))
        .filter(Boolean)
    : [];
  const imageUrl = String(input.imageUrl ?? "").trim();
  const knowledgeDescription = clampStr(
    String(input.knowledgeDescription ?? "").trim(),
    BOT_FIELD_MAX.knowledgeDescription,
  );
  const welcomeMessage = clampStr(String(input.welcomeMessage ?? "").trim(), BOT_FIELD_MAX.welcomeMessage);
  const openaiApiKeyOverride = String(input.openaiApiKeyOverride ?? "").trim();
  const isPublic = input.isPublic !== false;
  const status =
    input.status === "draft" || input.status === "published"
      ? input.status
      : undefined;
  const faqs = normalizeFaqs(input.faqs);

  const leadCapture = normalizeLeadCapture(input.leadCapture);
  const chatUIInput = (input.chatUI ?? {}) as BotChatUI;
  const menuQuickLinksMenuIcon = normalizeQuickLinkIcon(chatUIInput.menuQuickLinksMenuIcon);
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
    bubbleBorderRadius:
      typeof chatUIInput.bubbleBorderRadius === "number" && chatUIInput.bubbleBorderRadius >= 0 && chatUIInput.bubbleBorderRadius <= 32
        ? Math.round(chatUIInput.bubbleBorderRadius)
        : (chatUIInput as { bubbleStyle?: string }).bubbleStyle === "squared"
          ? 0
          : 20,
    launcherPosition:
      chatUIInput.launcherPosition === "bottom-left" || chatUIInput.launcherPosition === "bottom-right"
        ? chatUIInput.launcherPosition
        : "bottom-right",
    shadowIntensity:
      chatUIInput.shadowIntensity === "none" ||
        chatUIInput.shadowIntensity === "low" ||
        chatUIInput.shadowIntensity === "medium" ||
        chatUIInput.shadowIntensity === "high"
        ? chatUIInput.shadowIntensity
        : "medium",
    showChatBorder: chatUIInput.showChatBorder !== false,
    chatPanelBorderColor: chatUIInput.chatPanelBorderColor === "default" ? "default" : "primary",
    chatPanelBorderWidth:
      typeof chatUIInput.chatPanelBorderWidth === "number" &&
        chatUIInput.chatPanelBorderWidth >= 0 &&
        chatUIInput.chatPanelBorderWidth <= 5
        ? Math.round(chatUIInput.chatPanelBorderWidth)
        : 1,
    launcherIcon:
      chatUIInput.launcherIcon === "bot-avatar" || chatUIInput.launcherIcon === "custom"
        ? chatUIInput.launcherIcon
        : "default",
    launcherAvatarUrl:
      typeof chatUIInput.launcherAvatarUrl === "string" ? chatUIInput.launcherAvatarUrl.trim() || undefined : undefined,
    launcherAvatarRingWidth:
      typeof chatUIInput.launcherAvatarRingWidth === "number" &&
        chatUIInput.launcherAvatarRingWidth >= 0 &&
        chatUIInput.launcherAvatarRingWidth <= 30
        ? Math.round(chatUIInput.launcherAvatarRingWidth)
        : 18,
    launcherSize:
      typeof chatUIInput.launcherSize === "number" && chatUIInput.launcherSize >= 32 && chatUIInput.launcherSize <= 96
        ? Math.round(chatUIInput.launcherSize)
        : 48,
    launcherWhenOpen:
      chatUIInput.launcherWhenOpen === "close" || chatUIInput.launcherWhenOpen === "same"
        ? chatUIInput.launcherWhenOpen
        : "chevron-down",
    chatOpenAnimation:
      chatUIInput.chatOpenAnimation === "fade"
        ? "fade"
        : chatUIInput.chatOpenAnimation === "expand" || (chatUIInput as { chatOpenAnimation?: string }).chatOpenAnimation === "scale"
          ? "expand"
          : "slide-up-fade",
    openChatOnLoad: chatUIInput.openChatOnLoad !== false,
    showBranding: chatUIInput.showBranding !== false,
    brandingMessage: clampStr(
      typeof chatUIInput.brandingMessage === "string" ? chatUIInput.brandingMessage.trim() : "",
      BOT_FIELD_MAX.brandingMessage,
    ),
    showPrivacyText: chatUIInput.showPrivacyText !== false,
    privacyText: clampStr(
      typeof chatUIInput.privacyText === "string" ? chatUIInput.privacyText.trim() : "",
      BOT_FIELD_MAX.privacyText,
    ),
    liveIndicatorStyle:
      chatUIInput.liveIndicatorStyle === "dot-only" ? "dot-only" : "label",
    statusIndicator:
      chatUIInput.statusIndicator === "live" || chatUIInput.statusIndicator === "active"
        ? chatUIInput.statusIndicator
        : "none",
    statusDotStyle:
      chatUIInput.statusDotStyle === "static" ? "static" : "blinking",
    showScrollToBottom: chatUIInput.showScrollToBottom !== false,
    showScrollToBottomLabel: chatUIInput.showScrollToBottomLabel !== false,
    scrollToBottomLabel: clampStr(
      typeof chatUIInput.scrollToBottomLabel === "string" ? chatUIInput.scrollToBottomLabel.trim() : "",
      BOT_FIELD_MAX.scrollToBottomLabel,
    ),
    showScrollbar: chatUIInput.showScrollbar !== false,
    scrollChromeStyle: (() => {
      const s = chatUIInput.scrollChromeStyle;
      if (s === "default" || s === "defaultDark" || s === "primary") return s;
      if (s === "gray") return "defaultDark";
      return chatUIInput.scrollChromeUsesPrimary === false ? "default" : "primary";
    })(),
    scrollToBottomChromeStyle: (() => {
      const s = (chatUIInput as { scrollToBottomChromeStyle?: unknown }).scrollToBottomChromeStyle;
      if (s === "default" || s === "defaultDark" || s === "primary") return s;
      if (s === "gray") return "defaultDark";
      const sb = chatUIInput.scrollChromeStyle;
      if (sb === "default" || sb === "defaultDark" || sb === "primary") return sb;
      if (sb === "gray") return "defaultDark";
      return chatUIInput.scrollChromeUsesPrimary === false ? "default" : "primary";
    })(),
    composerAsSeparateBox: chatUIInput.composerAsSeparateBox !== false,
    composerBorderWidth:
      typeof chatUIInput.composerBorderWidth === "number" &&
        chatUIInput.composerBorderWidth >= 0 &&
        chatUIInput.composerBorderWidth <= 6
        ? (() => {
          const w = Number(chatUIInput.composerBorderWidth);
          return w > 0 && w < 0.5 ? 0.5 : Math.max(0, Math.min(6, w));
        })()
        : (chatUIInput as { showComposerBorder?: boolean }).showComposerBorder === false
          ? 0
          : 1,
    composerBorderColor: chatUIInput.composerBorderColor === "default" ? "default" : "primary",
    composerControlStyle: (() => {
      const s = chatUIInput.composerControlStyle;
      if (s === "brand" || s === "default" || s === "defaultDark") return s;
      return chatUIInput.composerControlsUsePrimary === false ? "default" : "defaultDark";
    })(),
    speechRecordingWaveStyle: (() => {
      const s = chatUIInput.speechRecordingWaveStyle;
      if (s === "brand" || s === "default" || s === "defaultDark") return s;
      return "default";
    })(),
    showMenuExpand: chatUIInput.showMenuExpand !== false,
    showMenuQuickLinks: chatUIInput.showMenuQuickLinks !== false,
    menuQuickLinks: normalizeMenuQuickLinks(chatUIInput.menuQuickLinks),
    ...(menuQuickLinksMenuIcon ? { menuQuickLinksMenuIcon } : {}),
    showComposerWithSuggestedQuestions: chatUIInput.showComposerWithSuggestedQuestions === true,
    hideSuggestionChipText: chatUIInput.hideSuggestionChipText === true,
    showAvatarInHeader: chatUIInput.showAvatarInHeader !== false,
    senderName: clampStr(
      typeof chatUIInput.senderName === "string" ? chatUIInput.senderName.trim() : "",
      BOT_FIELD_MAX.senderName,
    ),
    showSenderName: chatUIInput.showSenderName !== false,
    showTime: chatUIInput.showTime !== false,
    timePosition:
      chatUIInput.timePosition === "bottom" ? "bottom" : "top",
    showCopyButton: chatUIInput.showCopyButton !== false,
    showMessageFeedback: chatUIInput.showMessageFeedback !== false,
    userTextBubbleStyle:
      chatUIInput.userTextBubbleStyle === "default"
        ? "default"
        : chatUIInput.userTextBubbleStyle === "defaultDark"
          ? "defaultDark"
          : "primary",
    userVoiceBubbleStyle:
      chatUIInput.userVoiceBubbleStyle === "default"
        ? "default"
        : chatUIInput.userVoiceBubbleStyle === "defaultDark"
          ? "defaultDark"
          : "primary",
    showSources: chatUIInput.showSources === true,
    allowFileUpload: chatUIInput.allowFileUpload === true,
    showMic: chatUIInput.showMic === true,
    showVoice: Object.prototype.hasOwnProperty.call(chatUIInput, "showVoice")
      ? chatUIInput.showVoice === true
      : chatUIInput.showMic === true,
  };

  const personalityInput = (input.personality ?? {}) as BotPersonality;
  const personalityCandidate: BotPersonality = {
    name:
      typeof personalityInput.name === "string" && personalityInput.name.trim()
        ? clampStr(personalityInput.name.trim(), BOT_FIELD_MAX.personalityName)
        : undefined,
    description:
      typeof personalityInput.description === "string" && personalityInput.description.trim()
        ? clampStr(personalityInput.description.trim(), BOT_FIELD_MAX.personalityDescription)
        : undefined,
    systemPrompt:
      typeof personalityInput.systemPrompt === "string" && personalityInput.systemPrompt.trim()
        ? clampStr(personalityInput.systemPrompt.trim(), BOT_FIELD_MAX.personalitySystemPrompt)
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
        ? clampStr(personalityInput.language.trim(), BOT_FIELD_MAX.personalityLanguage)
        : undefined,
    thingsToAvoid:
      typeof personalityInput.thingsToAvoid === "string" && personalityInput.thingsToAvoid.trim()
        ? clampStr(personalityInput.thingsToAvoid.trim(), BOT_FIELD_MAX.thingsToAvoid)
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
