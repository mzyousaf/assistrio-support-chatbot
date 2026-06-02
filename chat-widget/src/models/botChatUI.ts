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

/** Visitor message bubbles: brand fill, neutral gray, or black (preview/live styling). */
export type UserBubbleStyle = "primary" | "default" | "defaultDark";

/** Send and voice (waveform) control styling in the composer. */
export type ComposerControlStyle = "brand" | "default" | "defaultDark";

/** Chat panel header: neutral strip (default) or brand-colored bar. */
export type ChatHeaderStyle = "default" | "brand";

/** Live level meter while recording voice / dictate. */
export type SpeechRecordingWaveStyle = "brand" | "default" | "defaultDark";

/** Scrollbar thumb + scroll-to-latest control: neutrals or brand accent. */
export type ScrollChromeStyle = "default" | "defaultDark" | "primary";

/** Horizontal placement of the floating scroll-to-latest control. */
export type ScrollToBottomAlign = "left" | "center" | "right";

export interface BotChatUI {
  primaryColor?: string;
  backgroundStyle?: ChatBackgroundStyle;
  bubbleBorderRadius?: number;
  launcherPosition?: ChatLauncherPosition;
  shadowIntensity?: ChatShadowIntensity;
  showChatBorder?: boolean;
  /** Panel outline color when border is shown: neutral or brand (default `primary`). */
  chatPanelBorderColor?: "default" | "primary";
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
  /** Logo + “Powered by Assistrio” strip above the composer (before the first visitor message). Default true. */
  showAssistrioBrandingPaid?: boolean;
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
  /** Message list scrollbar thumb (default `default`). */
  scrollChromeStyle?: ScrollChromeStyle;
  /** Floating “scroll to latest” button fill (default: same as {@link scrollChromeStyle} when omitted). */
  scrollToBottomChromeStyle?: ScrollChromeStyle;
  /** Floating scroll-to-latest button alignment (default `center`). */
  scrollToBottomAlign?: ScrollToBottomAlign;
  /**
   * @deprecated Use `scrollChromeStyle`. `false` → `default`, omitted/`true` → `primary`.
   */
  scrollChromeUsesPrimary?: boolean;
  composerAsSeparateBox?: boolean;
  composerBorderWidth?: number;
  composerBorderColor?: "default" | "primary";
  /**
   * Send + voice (waveform) button look: brand fill, neutral, or dark chip.
   * When set, overrides {@link composerControlsUsePrimary}.
   */
  composerControlStyle?: ComposerControlStyle;
  /**
   * @deprecated Use `composerControlStyle`. `false` → `default`, omitted/`true` → `defaultDark`.
   */
  composerControlsUsePrimary?: boolean;
  /** Bar colors in the live recording level meter (composer). */
  speechRecordingWaveStyle?: SpeechRecordingWaveStyle;
  showMenuExpand?: boolean;
  /** When false, hide the quick links header control even if links are configured (default true). */
  showMenuQuickLinks?: boolean;
  /** Icon id for the header control that opens quick links (default link-2). */
  menuQuickLinksMenuIcon?: string;
  menuQuickLinks?: ChatMenuQuickLink[];
  showComposerWithSuggestedQuestions?: boolean;
  /**
   * When true, first-screen suggestion chips hide visible label text (still sends the same message / suggestion id).
   * Separate from per-item “Use in replies” in the knowledge base.
   */
  hideSuggestionChipText?: boolean;
  showAvatarInHeader?: boolean;
  /** Header bar fill: neutral (default) or brand primary color with contrasting text/icons. */
  headerStyle?: ChatHeaderStyle;
  /** @deprecated Stored on legacy bots; widget no longer shows name/time/sources in-thread. */
  senderName?: string;
  /** @deprecated Stored on legacy bots; widget no longer shows name/time/sources in-thread. */
  showSenderName?: boolean;
  /** @deprecated Stored on legacy bots; widget no longer shows name/time/sources in-thread. */
  showTime?: boolean;
  showCopyButton?: boolean;
  /**
   * When true, workspace **preview** may show citation sources on assistant replies.
   * Live embedded chat does not surface sources to visitors.
   */
  showSources?: boolean;
  timePosition?: ChatTimePosition;
  /** Thumbs up/down on assistant replies (default true). */
  showMessageFeedback?: boolean;
  /** Typed visitor messages only. Voice ignores this. */
  userTextBubbleStyle?: UserBubbleStyle;
  /** Voice visitor messages only. Text ignores this. */
  userVoiceBubbleStyle?: UserBubbleStyle;
  allowFileUpload?: boolean;
  /** Dictate / microphone control. */
  showMic?: boolean;
  /** Voice (waveform) control; legacy bots may omit and mirror `showMic`. */
  showVoice?: boolean;
}
