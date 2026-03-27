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
}

export type ChatLauncherIcon = "default" | "bot-avatar" | "custom";
export type ChatShadowIntensity = "none" | "low" | "medium" | "high";
export type ChatOpenAnimation = "slide-up-fade" | "fade" | "expand";

export interface BotChatUI {
  primaryColor?: string;
  backgroundStyle?: ChatBackgroundStyle;
  bubbleBorderRadius?: number;
  launcherPosition?: ChatLauncherPosition;
  shadowIntensity?: ChatShadowIntensity;
  showChatBorder?: boolean;
  launcherIcon?: ChatLauncherIcon;
  launcherAvatarUrl?: string;
  launcherAvatarRingWidth?: number;
  launcherSize?: number;
  chatOpenAnimation?: ChatOpenAnimation;
  openChatOnLoad?: boolean;
  showBranding?: boolean;
  brandingMessage?: string;
  liveIndicatorStyle?: LiveIndicatorStyle;
  statusIndicator?: ChatStatusIndicator;
  statusDotStyle?: "blinking" | "static";
  showScrollToBottom?: boolean;
  showScrollbar?: boolean;
  composerAsSeparateBox?: boolean;
  composerBorderWidth?: number;
  composerBorderColor?: "default" | "primary";
  showMenuExpand?: boolean;
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
