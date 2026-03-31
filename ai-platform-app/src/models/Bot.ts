/** FAQ item (content owned by knowledge base; API contract only). */
export interface BotFaq {
  question: string;
  answer: string;
  /** When false, this FAQ is excluded from retrieval/chunks. */
  active?: boolean;
}

export interface BotPersonality {
  name?: string;
  description?: string;
  systemPrompt?: string;
  /** Behavior preset key (default, support, sales, …). Persisted so dropdown reflects after reload. */
  behaviorPreset?: string;
  tone?: "friendly" | "formal" | "playful" | "technical";
  language?: string;
  /** Things the bot should avoid (topics, behaviours). Used in behaviour context. */
  thingsToAvoid?: string;
}

export interface BotConfig {
  temperature?: number;
  maxTokens?: number;
  responseLength?: "short" | "medium" | "long";
}

export type LeadFieldType = "text" | "email" | "phone" | "number" | "url";

export interface BotLeadField {
  key: string;
  label: string;
  type: LeadFieldType;
  required?: boolean;
  /** When true, field is kept in the list but not used for capture or asking. */
  disabled?: boolean;
}

export type LeadAskStrategy = "soft" | "balanced" | "direct";
/** @deprecated Legacy API values; admin UI always saves `chat`. */
export type LeadCaptureMode = "chat" | "form" | "hybrid";

export interface BotLeadCaptureV2 {
  enabled?: boolean;
  fields?: BotLeadField[];
  /** How often the assistant is nudged to ask for missing fields (backend). Default balanced. */
  askStrategy?: LeadAskStrategy;
  /** @deprecated Use personality tone in Behavior instead; not set from admin. */
  politeMode?: boolean;
  /** @deprecated Ignored by admin UI; persisted as `chat`. */
  captureMode?: LeadCaptureMode;
}

export interface BotLeadCaptureLegacy {
  collectName?: boolean;
  collectEmail?: boolean;
  collectPhone?: boolean;
}

export type ChatBackgroundStyle = "auto" | "light" | "dark";
export type ChatLauncherPosition = "bottom-right" | "bottom-left";
/** Message bubble border radius in pixels (0–32). Affects message bubbles and suggested chips. */
export const BUBBLE_RADIUS_MIN = 0;
export const BUBBLE_RADIUS_MAX = 32;
/** "label" = dot + label next to title; "dot-only" = dot overlapping avatar */
export type LiveIndicatorStyle = "label" | "dot-only";
/** Header status: "live" | "active" | "none". When "none", no status pill/label is shown. */
export type ChatStatusIndicator = "live" | "active" | "none";
/** Where to show message time: "top" (above message) or "bottom" (assistant=right, user=left) */
export type ChatTimePosition = "top" | "bottom";

/** Quick link in chat header menu (max 10): display text + route/URL + optional icon id (curated list). */
export interface ChatMenuQuickLink {
  text: string;
  route: string;
  icon?: string;
}

/** Launcher icon source: default chat icon, bot avatar (with background), or custom upload */
export type ChatLauncherIcon = "default" | "bot-avatar" | "custom";
/** Launcher button while chat panel is open */
export type ChatLauncherWhenOpen = "close" | "chevron-down" | "same";
/** Shadow intensity for chat and launcher */
export type ChatShadowIntensity = "none" | "low" | "medium" | "high";
/** Chat open/close animation style: slide-up-fade, fade, or expand (grows from launcher) */
export type ChatOpenAnimation = "slide-up-fade" | "fade" | "expand";

export interface BotChatUI {
  primaryColor?: string;
  backgroundStyle?: ChatBackgroundStyle;
  /** Message bubble border radius in pixels (0–32). Affects message bubbles and suggested chips. */
  bubbleBorderRadius?: number;
  launcherPosition?: ChatLauncherPosition;
  /** Shadow intensity for chat panel and launcher (default "medium") */
  shadowIntensity?: ChatShadowIntensity;
  /** When true, show a border around the chat panel using primary color (default true). */
  showChatBorder?: boolean;
  /** Chat panel border width in px (0–5). 0 = no visible border. Default 1. */
  chatPanelBorderWidth?: number;
  /** Launcher icon: default, bot avatar with background, or custom upload (default "default") */
  launcherIcon?: ChatLauncherIcon;
  /** When launcherIcon is "custom", image URL or data URL from upload */
  launcherAvatarUrl?: string;
  /** When launcherIcon is "bot-avatar", ring width (accent around avatar) 0–30 percent; 0 = no ring (default 18) */
  launcherAvatarRingWidth?: number;
  /** Launcher button size in pixels (default 48) */
  launcherSize?: number;
  /** Icon while chat is open: X, down arrow (default), or same as closed */
  launcherWhenOpen?: ChatLauncherWhenOpen;
  /** How the chat panel opens/closes: slide-up-fade, fade, or expand (default "slide-up-fade") */
  chatOpenAnimation?: ChatOpenAnimation;
  /** When true, chat opens automatically on page load (default true). Only applies where the widget is used (e.g. bot edit page). */
  openChatOnLoad?: boolean;
  showBranding?: boolean;
  /** Editable text in footer when showBranding is true (e.g. "Powered by ...") */
  brandingMessage?: string;
  /** When false, hide the privacy/footer line even if privacyText is set (default true). */
  showPrivacyText?: boolean;
  /** Optional second footer line (e.g. privacy notice). Shown when showPrivacyText is true. */
  privacyText?: string;
  liveIndicatorStyle?: LiveIndicatorStyle;
  /** Header status: "live" | "active" | "none" (default "none") */
  statusIndicator?: ChatStatusIndicator;
  /** Status dot: "blinking" or "static" (default "blinking") */
  statusDotStyle?: "blinking" | "static";
  /** Show scroll-to-bottom button when user scrolls up (default true) */
  showScrollToBottom?: boolean;
  /** Show label text beside the scroll-to-bottom arrow (default true) */
  showScrollToBottomLabel?: boolean;
  /** Custom scroll-to-bottom label; empty uses widget default (“Scroll to latest”) */
  scrollToBottomLabel?: string;
  /** Show scrollbar in message area (default true). When false, scrollbar is hidden but content still scrolls. */
  showScrollbar?: boolean;
  /** When true, message input is a separate box (border-top + bg). When false, no border and no bg (default true). */
  composerAsSeparateBox?: boolean;
  /** Message input border width in px. 0 = default 1px; 0.5–6 = custom (min 0.5). Focus = width × 1.5. Default 1. */
  composerBorderWidth?: number;
  /** When composerBorderWidth >= 0.5: "default" = gray border, "primary" = primary color. Default "primary". */
  composerBorderColor?: "default" | "primary";
  /** Show "Expand chat" option in header menu (default true) */
  showMenuExpand?: boolean;
  /** When false, hide the quick links menu in the chat header (default true). */
  showMenuQuickLinks?: boolean;
  /** Quick links in header menu (max 10) */
  menuQuickLinks?: ChatMenuQuickLink[];
  /** Icon id for the header button that opens quick links (default link-2). */
  menuQuickLinksMenuIcon?: string;
  /** When true, show chat input with suggested questions on first message. When false, only quick-question chips until user picks one (default false). */
  showComposerWithSuggestedQuestions?: boolean;
  /** Show bot avatar in chat header (default true) */
  showAvatarInHeader?: boolean;
  /** Display name for assistant/sender (e.g. "Bot Name - AI"). Empty = use bot name + " - AI". */
  senderName?: string;
  /** Show sender/assistant name above messages (default true) */
  showSenderName?: boolean;
  /** Show message time in metadata (default true) */
  showTime?: boolean;
  /** Show copy button on assistant messages (default true) */
  showCopyButton?: boolean;
  /** Show sources on assistant messages (default true) */
  showSources?: boolean;
  /** Where to show time: top (above message) or bottom (assistant=right, user=left) */
  timePosition?: ChatTimePosition;
  /** Show emoji picker in composer (default true) */
  showEmoji?: boolean;
  /** Allow file uploads in chat (Integration; consumes more GPT) */
  allowFileUpload?: boolean;
  /** Show mic button; when true, Whisper API key required in Integrations */
  showMic?: boolean;
}

export interface BotDocument {
  name: string;
  slug: string;
  type: "showcase" | "visitor-own";
  ownerVisitorId?: string;
  ownerUserId?: string;
  creatorType?: "user" | "visitor";
  visibility?: "public" | "private";
  accessKey?: string;
  secretKey?: string;
  messageLimitMode?: "none" | "fixed_total";
  messageLimitTotal?: number | null;
  messageLimitUpgradeMessage?: string | null;
  /** When true, embed visitors can start multiple saved conversations (see visitorMultiChatMax). */
  visitorMultiChatEnabled?: boolean;
  /** Max saved threads per visitor when visitorMultiChatEnabled; omit/null = unlimited. Minimum 2 when set (current chat counts as one). */
  visitorMultiChatMax?: number | null;
  isPublic: boolean;
  shortDescription?: string;
  category?: string;
  categories?: string[];
  avatarEmoji?: string;
  imageUrl?: string;
  openaiApiKeyOverride?: string;
  whisperApiKeyOverride?: string;
  limitOverrideMessages?: number;
  clientDraftId?: string;
  status?: "draft" | "published";
  welcomeMessage?: string;
  leadCapture?: BotLeadCaptureV2;
  chatUI?: BotChatUI;
  description?: string;
  /** Note content (sourced from knowledge base for display). */
  knowledgeDescription?: string;
  /** FAQs (sourced from knowledge base for display). */
  faqs?: BotFaq[];
  exampleQuestions?: string[];
  personality?: BotPersonality;
  config?: BotConfig;
  /** Runtime allowlist: hostname entries (subdomains allowed) or `exact:<origin>` for one origin only. */
  allowedDomains?: string[];
  createdAt: Date;
}
