/**
 * Chat UI settings for the widget (extracted from app `models/Bot.ts`).
 * Only types required by BotChatUI and embed normalization.
 */

export type ChatBackgroundStyle = "auto" | "light" | "dark";
export type ChatLauncherPosition = "bottom-right" | "bottom-left";
export type LiveIndicatorStyle = "label" | "dot-only";
export type ChatStatusIndicator = "live" | "active" | "none";
export type ChatTimePosition = "top" | "bottom";

export interface ChatMenuQuickLink {
  text: string;
  route: string;
  /** Lucide quick-link id from curated list; omit for default (external-link). */
  icon?: string;
}

export type ChatLauncherIcon = "default" | "bot-avatar" | "custom";
/** Icon on the floating launcher while the chat panel is open. */
export type ChatLauncherWhenOpen = "close" | "chevron-down" | "same";
export type ChatShadowIntensity = "none" | "low" | "medium" | "high";
export type ChatOpenAnimation = "slide-up-fade" | "fade" | "expand";

export interface BotChatUI {
  primaryColor?: string;
  backgroundStyle?: ChatBackgroundStyle;
  bubbleBorderRadius?: number;
  launcherPosition?: ChatLauncherPosition;
  shadowIntensity?: ChatShadowIntensity;
  showChatBorder?: boolean;
  /** Chat panel border width in px (0–5). Default 1. */
  chatPanelBorderWidth?: number;
  launcherIcon?: ChatLauncherIcon;
  launcherAvatarUrl?: string;
  launcherAvatarRingWidth?: number;
  launcherSize?: number;
  /**
   * Launcher button when chat is open: X, down arrow (default), or same as closed (e.g. bot avatar).
   * Default "chevron-down".
   */
  launcherWhenOpen?: ChatLauncherWhenOpen;
  chatOpenAnimation?: ChatOpenAnimation;
  openChatOnLoad?: boolean;
  showBranding?: boolean;
  brandingMessage?: string;
  /** When false, hide the privacy/footer line even if `privacyText` is set (default true). */
  showPrivacyText?: boolean;
  /** Footer line below branding (e.g. privacy notice). Shown when `showPrivacyText` is true and text is non-empty. */
  privacyText?: string;
  liveIndicatorStyle?: LiveIndicatorStyle;
  statusIndicator?: ChatStatusIndicator;
  statusDotStyle?: "blinking" | "static";
  showScrollToBottom?: boolean;
  /** When true, show label beside the scroll-to-bottom arrow (default true) */
  showScrollToBottomLabel?: boolean;
  /** Custom label; empty uses default “Scroll to latest” */
  scrollToBottomLabel?: string;
  showScrollbar?: boolean;
  composerAsSeparateBox?: boolean;
  composerBorderWidth?: number;
  composerBorderColor?: "default" | "primary";
  showMenuExpand?: boolean;
  /** When false, hide the quick links header control even if links are configured (default true). */
  showMenuQuickLinks?: boolean;
  /** Icon id for the header control that opens quick links (default link-2). */
  menuQuickLinksMenuIcon?: string;
  menuQuickLinks?: ChatMenuQuickLink[];
  showComposerWithSuggestedQuestions?: boolean;
  showAvatarInHeader?: boolean;
  senderName?: string;
  showSenderName?: boolean;
  showTime?: boolean;
  showCopyButton?: boolean;
  showSources?: boolean;
  timePosition?: ChatTimePosition;
  showEmoji?: boolean;
  allowFileUpload?: boolean;
  showMic?: boolean;
}
