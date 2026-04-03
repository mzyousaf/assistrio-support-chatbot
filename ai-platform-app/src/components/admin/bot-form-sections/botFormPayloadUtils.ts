import { normalizeQuickLinkIcon } from "@/lib/quickLinkIconNormalize";
import type { BotChatUI } from "@/models/Bot";

/** Default chat UI baseline (aligned with BotForm). */
export const DEFAULT_CHAT_UI: Required<Omit<BotChatUI, "menuQuickLinks" | "launcherAvatarUrl" | "menuQuickLinksMenuIcon">> & {
  menuQuickLinks: BotChatUI["menuQuickLinks"];
  launcherAvatarUrl?: string;
} = {
  primaryColor: "#14B8A6",
  backgroundStyle: "light",
  bubbleBorderRadius: 20,
  launcherPosition: "bottom-right",
  shadowIntensity: "medium",
  showChatBorder: true,
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
  composerAsSeparateBox: true,
  composerBorderWidth: 1,
  composerBorderColor: "primary",
  showMenuExpand: true,
  showMenuQuickLinks: true,
  menuQuickLinks: [],
  showComposerWithSuggestedQuestions: false,
  showAvatarInHeader: true,
  senderName: "",
  showSenderName: true,
  showTime: true,
  timePosition: "top",
  showCopyButton: true,
  showSources: true,
  showEmoji: true,
  allowFileUpload: false,
  showMic: false,
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
    brandingMessage: chatUI.brandingMessage ?? DEFAULT_CHAT_UI.brandingMessage,
    showPrivacyText: chatUI.showPrivacyText ?? DEFAULT_CHAT_UI.showPrivacyText,
    privacyText: chatUI.privacyText?.trim() || undefined,
    liveIndicatorStyle: chatUI.liveIndicatorStyle ?? DEFAULT_CHAT_UI.liveIndicatorStyle,
    statusIndicator: chatUI.statusIndicator ?? DEFAULT_CHAT_UI.statusIndicator,
    statusDotStyle: chatUI.statusDotStyle ?? DEFAULT_CHAT_UI.statusDotStyle,
    showScrollToBottom: chatUI.showScrollToBottom ?? DEFAULT_CHAT_UI.showScrollToBottom,
    showScrollToBottomLabel: chatUI.showScrollToBottomLabel ?? DEFAULT_CHAT_UI.showScrollToBottomLabel,
    scrollToBottomLabel:
      typeof chatUI.scrollToBottomLabel === "string" ? chatUI.scrollToBottomLabel.trim() : "",
    showScrollbar: chatUI.showScrollbar ?? DEFAULT_CHAT_UI.showScrollbar,
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
    showMenuExpand: chatUI.showMenuExpand ?? DEFAULT_CHAT_UI.showMenuExpand,
    showMenuQuickLinks: chatUI.showMenuQuickLinks ?? DEFAULT_CHAT_UI.showMenuQuickLinks,
    menuQuickLinks: chatUI.menuQuickLinks?.length ? chatUI.menuQuickLinks : undefined,
    ...(menuQuickLinksMenuIcon ? { menuQuickLinksMenuIcon } : {}),
    showComposerWithSuggestedQuestions: chatUI.showComposerWithSuggestedQuestions ?? false,
    showAvatarInHeader: chatUI.showAvatarInHeader ?? DEFAULT_CHAT_UI.showAvatarInHeader,
    senderName: chatUI.senderName ?? DEFAULT_CHAT_UI.senderName,
    showSenderName: chatUI.showSenderName ?? DEFAULT_CHAT_UI.showSenderName,
    showTime: chatUI.showTime ?? DEFAULT_CHAT_UI.showTime,
    timePosition: chatUI.timePosition ?? DEFAULT_CHAT_UI.timePosition,
    showCopyButton: chatUI.showCopyButton ?? DEFAULT_CHAT_UI.showCopyButton,
    showSources: chatUI.showSources ?? DEFAULT_CHAT_UI.showSources,
    showEmoji: chatUI.showEmoji ?? DEFAULT_CHAT_UI.showEmoji,
    allowFileUpload: chatUI.allowFileUpload ?? DEFAULT_CHAT_UI.allowFileUpload,
    showMic: chatUI.showMic ?? DEFAULT_CHAT_UI.showMic,
  };
}
