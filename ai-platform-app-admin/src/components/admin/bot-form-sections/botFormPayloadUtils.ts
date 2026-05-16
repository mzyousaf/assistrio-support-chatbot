import { BOT_FIELD_MAX, clampStr } from "@/lib/botFieldLimits";
import { normalizeQuickLinkIcon } from "@/lib/quickLinkIconNormalize";
import type { BotChatUI } from "@/models/Bot";

/** Default chat UI baseline (aligned with BotForm). */
export const DEFAULT_CHAT_UI: Required<
  Omit<
    BotChatUI,
    | "menuQuickLinks"
    | "launcherAvatarUrl"
    | "menuQuickLinksMenuIcon"
    | "composerControlsUsePrimary"
    | "scrollChromeUsesPrimary"
    | "scrollToBottomChromeStyle"
  >
> & {
  menuQuickLinks: BotChatUI["menuQuickLinks"];
  launcherAvatarUrl?: string;
} = {
  primaryColor: "#14B8A6",
  backgroundStyle: "light",
  bubbleBorderRadius: 20,
  launcherPosition: "bottom-right",
  shadowIntensity: "medium",
  showChatBorder: true,
  chatPanelBorderColor: "primary",
  chatPanelBorderWidth: 1,
  launcherIcon: "default",
  launcherAvatarRingWidth: 18,
  launcherSize: 48,
  launcherWhenOpen: "chevron-down",
  chatOpenAnimation: "slide-up-fade",
  openChatOnLoad: true,
  showBranding: true,
  showPrivacyText: true,
  liveIndicatorStyle: "label",
  statusIndicator: "none",
  statusDotStyle: "blinking",
  showScrollToBottom: true,
  showScrollToBottomLabel: true,
  scrollToBottomLabel: "",
  showScrollbar: true,
  scrollChromeStyle: "default",
  composerAsSeparateBox: true,
  composerBorderWidth: 1,
  composerBorderColor: "primary",
  composerControlStyle: "defaultDark",
  speechRecordingWaveStyle: "default",
  showMenuExpand: true,
  showMenuQuickLinks: true,
  menuQuickLinks: [],
  showComposerWithSuggestedQuestions: false,
  hideSuggestionChipText: false,
  showAvatarInHeader: true,
  senderName: "",
  showSenderName: false,
  showTime: false,
  timePosition: "top",
  showCopyButton: true,
  showMessageFeedback: true,
  userTextBubbleStyle: "primary",
  userVoiceBubbleStyle: "primary",
  showSources: false,
  allowFileUpload: false,
  showMic: false,
  showVoice: false,
  brandingMessage: "",
  privacyText: "",
};

export function presetToPrompt(preset: string) {
  switch (preset) {
    case "support":
      return "You are a friendly support agent. Be concise and helpful.";
    case "sales":
      return "You are a sales assistant. Clarify needs and propose best options.";
    case "technical":
      return "You are a technical assistant. Be precise and step-by-step.";
    case "marketing":
      return "You are a marketing assistant. Focus on messaging, positioning, and conversion clarity.";
    case "consultative":
      return "You are a consultative advisor. Ask clarifying questions before recommending solutions.";
    case "teacher":
      return "You are a patient teacher. Explain concepts clearly with practical examples.";
    case "empathetic":
      return "You are an empathetic assistant. Acknowledge user concerns and respond supportively.";
    case "strict":
      return "You are a strict assistant. Only answer if the info is clearly provided.";
    case "concise":
      return "You are a concise assistant. Prefer short answers; expand only when the user asks for detail.";
    case "creative":
      return "You are a creative assistant. Use engaging language while staying accurate and on-brand.";
    case "research":
      return "You are a research-oriented assistant. Cite uncertainty, compare options, and avoid speculation.";
    case "executive":
      return "You are an executive assistant. Be polished, structured, and respectful of the user's time.";
    case "hospitality":
      return "You are a hospitality-focused assistant. Be warm, welcoming, and service-oriented.";
    case "coach":
      return "You are a coaching-style assistant. Ask thoughtful questions, encourage progress, and keep guidance actionable.";
    case "analyst":
      return "You are an analytical assistant. Prefer structured answers, clarify assumptions, and separate facts from interpretation.";
    case "storyteller":
      return "You are a storytelling assistant. Use clear narratives and examples while staying accurate and concise.";
    case "startup":
      return "You are a startup-minded assistant. Be pragmatic, fast-moving, and focused on outcomes.";
    case "journalistic":
      return "You are a neutral, journalistic assistant. Be clear and balanced; avoid hype and unverified claims.";
    case "companion":
      return "You are a conversational companion. Be natural, attentive, and easy to talk to while staying helpful and accurate.";
    case "simplifier":
      return "You are a plain-language simplifier. Prefer short sentences, define jargon when needed, and make complex ideas easy to follow.";
    case "facilitator":
      return "You are a facilitator. Keep discussions clear, offer gentle structure, summarize when helpful, and suggest practical next steps.";
    case "advocate":
      return "You are a customer advocate. Prioritize the user's goals, be fair, and help them get a clear path forward.";
    case "negotiator":
      return "You are a negotiation-oriented assistant. Seek common ground, clarify tradeoffs, and avoid escalating conflict.";
    case "interviewer":
      return "You are an interviewer-style assistant. Ask focused questions one at a time, listen to answers, and adapt follow-ups.";
    default:
      return "You are a helpful assistant.";
  }
}

/** Normalized chat UI for save + embed preview (single source of truth). */
export function buildChatUiPayload(chatUI: BotChatUI): BotChatUI {
  const menuQuickLinksMenuIcon = normalizeQuickLinkIcon(chatUI.menuQuickLinksMenuIcon);
  return {
    primaryColor: chatUI.primaryColor || DEFAULT_CHAT_UI.primaryColor,
    backgroundStyle: chatUI.backgroundStyle || DEFAULT_CHAT_UI.backgroundStyle,
    bubbleBorderRadius: chatUI.bubbleBorderRadius ?? DEFAULT_CHAT_UI.bubbleBorderRadius,
    launcherPosition: chatUI.launcherPosition || DEFAULT_CHAT_UI.launcherPosition,
    shadowIntensity: chatUI.shadowIntensity ?? DEFAULT_CHAT_UI.shadowIntensity,
    showChatBorder: chatUI.showChatBorder ?? DEFAULT_CHAT_UI.showChatBorder,
    chatPanelBorderWidth:
      typeof chatUI.chatPanelBorderWidth === "number" &&
      chatUI.chatPanelBorderWidth >= 0 &&
      chatUI.chatPanelBorderWidth <= 5
        ? Math.round(chatUI.chatPanelBorderWidth)
        : DEFAULT_CHAT_UI.chatPanelBorderWidth,
    launcherIcon: chatUI.launcherIcon ?? DEFAULT_CHAT_UI.launcherIcon,
    launcherAvatarUrl: chatUI.launcherAvatarUrl?.trim() || undefined,
    launcherAvatarRingWidth: chatUI.launcherAvatarRingWidth ?? DEFAULT_CHAT_UI.launcherAvatarRingWidth,
    launcherSize: chatUI.launcherSize ?? DEFAULT_CHAT_UI.launcherSize,
    launcherWhenOpen:
      chatUI.launcherWhenOpen === "close" || chatUI.launcherWhenOpen === "same"
        ? chatUI.launcherWhenOpen
        : DEFAULT_CHAT_UI.launcherWhenOpen,
    chatOpenAnimation: chatUI.chatOpenAnimation ?? DEFAULT_CHAT_UI.chatOpenAnimation,
    openChatOnLoad: chatUI.openChatOnLoad ?? DEFAULT_CHAT_UI.openChatOnLoad,
    showBranding: chatUI.showBranding ?? DEFAULT_CHAT_UI.showBranding,
    brandingMessage: clampStr(
      (chatUI.brandingMessage ?? DEFAULT_CHAT_UI.brandingMessage) || "",
      BOT_FIELD_MAX.brandingMessage,
    ),
    showPrivacyText: chatUI.showPrivacyText ?? DEFAULT_CHAT_UI.showPrivacyText,
    privacyText: (() => {
      const t = chatUI.privacyText?.trim();
      return t ? clampStr(t, BOT_FIELD_MAX.privacyText) : undefined;
    })(),
    liveIndicatorStyle: chatUI.liveIndicatorStyle ?? DEFAULT_CHAT_UI.liveIndicatorStyle,
    statusIndicator: chatUI.statusIndicator ?? DEFAULT_CHAT_UI.statusIndicator,
    statusDotStyle: chatUI.statusDotStyle ?? DEFAULT_CHAT_UI.statusDotStyle,
    showScrollToBottom: chatUI.showScrollToBottom ?? DEFAULT_CHAT_UI.showScrollToBottom,
    showScrollToBottomLabel: chatUI.showScrollToBottomLabel ?? DEFAULT_CHAT_UI.showScrollToBottomLabel,
    scrollToBottomLabel: clampStr(
      typeof chatUI.scrollToBottomLabel === "string" ? chatUI.scrollToBottomLabel.trim() : "",
      BOT_FIELD_MAX.scrollToBottomLabel,
    ),
    showScrollbar: chatUI.showScrollbar ?? DEFAULT_CHAT_UI.showScrollbar,
    scrollChromeStyle: (() => {
      const s = chatUI.scrollChromeStyle;
      if (s === "default" || s === "defaultDark" || s === "primary") return s;
      if (s === "gray") return "defaultDark";
      return chatUI.scrollChromeUsesPrimary === false ? "default" : "primary";
    })(),
    scrollToBottomChromeStyle: (() => {
      const s = chatUI.scrollToBottomChromeStyle;
      if (s === "default" || s === "defaultDark" || s === "primary") return s;
      if (s === "gray") return "defaultDark";
      const sb = chatUI.scrollChromeStyle;
      if (sb === "default" || sb === "defaultDark" || sb === "primary") return sb;
      if (sb === "gray") return "defaultDark";
      return chatUI.scrollChromeUsesPrimary === false ? "default" : "primary";
    })(),
    composerAsSeparateBox: chatUI.composerAsSeparateBox ?? DEFAULT_CHAT_UI.composerAsSeparateBox,
    composerBorderWidth:
      typeof chatUI.composerBorderWidth === "number" && chatUI.composerBorderWidth >= 0 && chatUI.composerBorderWidth <= 6
        ? (() => {
            const w = chatUI.composerBorderWidth!;
            return w > 0 && w < 0.5 ? 0.5 : w;
          })()
        : (chatUI as { showComposerBorder?: boolean }).showComposerBorder === false
          ? 0
          : DEFAULT_CHAT_UI.composerBorderWidth,
    composerBorderColor: chatUI.composerBorderColor ?? DEFAULT_CHAT_UI.composerBorderColor,
    composerControlStyle:
      chatUI.composerControlStyle === "brand" ||
        chatUI.composerControlStyle === "default" ||
        chatUI.composerControlStyle === "defaultDark"
        ? chatUI.composerControlStyle
        : chatUI.composerControlsUsePrimary === false
          ? "default"
          : "defaultDark",
    speechRecordingWaveStyle:
      chatUI.speechRecordingWaveStyle === "brand" ||
        chatUI.speechRecordingWaveStyle === "default" ||
        chatUI.speechRecordingWaveStyle === "defaultDark"
        ? chatUI.speechRecordingWaveStyle
        : "default",
    showMenuExpand: chatUI.showMenuExpand ?? DEFAULT_CHAT_UI.showMenuExpand,
    showMenuQuickLinks: chatUI.showMenuQuickLinks ?? DEFAULT_CHAT_UI.showMenuQuickLinks,
    menuQuickLinks: chatUI.menuQuickLinks?.length ? chatUI.menuQuickLinks : undefined,
    ...(menuQuickLinksMenuIcon ? { menuQuickLinksMenuIcon } : {}),
    showComposerWithSuggestedQuestions: chatUI.showComposerWithSuggestedQuestions ?? false,
    hideSuggestionChipText: chatUI.hideSuggestionChipText === true,
    showAvatarInHeader: chatUI.showAvatarInHeader ?? DEFAULT_CHAT_UI.showAvatarInHeader,
    senderName: clampStr(
      (chatUI.senderName ?? DEFAULT_CHAT_UI.senderName) || "",
      BOT_FIELD_MAX.senderName,
    ),
    showSenderName: chatUI.showSenderName ?? DEFAULT_CHAT_UI.showSenderName,
    showTime: chatUI.showTime ?? DEFAULT_CHAT_UI.showTime,
    timePosition: chatUI.timePosition ?? DEFAULT_CHAT_UI.timePosition,
    showCopyButton: chatUI.showCopyButton ?? DEFAULT_CHAT_UI.showCopyButton,
    showMessageFeedback: chatUI.showMessageFeedback ?? DEFAULT_CHAT_UI.showMessageFeedback,
    userTextBubbleStyle:
      chatUI.userTextBubbleStyle === "default"
        ? "default"
        : chatUI.userTextBubbleStyle === "defaultDark"
          ? "defaultDark"
          : "primary",
    userVoiceBubbleStyle:
      chatUI.userVoiceBubbleStyle === "default"
        ? "default"
        : chatUI.userVoiceBubbleStyle === "defaultDark"
          ? "defaultDark"
          : "primary",
    showSources: chatUI.showSources === true,
    allowFileUpload: chatUI.allowFileUpload ?? DEFAULT_CHAT_UI.allowFileUpload,
    showMic: chatUI.showMic ?? DEFAULT_CHAT_UI.showMic,
    showVoice:
      typeof chatUI.showVoice === "boolean"
        ? chatUI.showVoice
        : (chatUI.showMic ?? DEFAULT_CHAT_UI.showMic),
  };
}
