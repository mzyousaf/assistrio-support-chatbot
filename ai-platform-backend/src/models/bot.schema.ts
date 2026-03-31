import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { generateBotAccessKey, generateBotSecretKey } from '../bots/bot-keys.util';

export type LeadFieldType = 'text' | 'email' | 'phone' | 'number' | 'url';

@Schema({ _id: false })
export class BotLeadField {
  @Prop({ required: true })
  key: string;
  @Prop({ required: true })
  label: string;
  @Prop({ enum: ['text', 'email', 'phone', 'number', 'url'], default: 'text' })
  type: LeadFieldType;
  @Prop({ default: true })
  required?: boolean;
  /** When true, field is kept but excluded from capture and prompts. */
  @Prop({ default: false })
  disabled?: boolean;
  /** Optional aliases for spontaneous extraction (e.g. ["employees", "staff", "headcount"] for team_size). */
  @Prop({ type: [String], default: undefined })
  aliases?: string[];
}

@Schema({ _id: false })
export class BotLeadCaptureV2 {
  @Prop({ default: false })
  enabled?: boolean;
  @Prop({ type: [BotLeadField], default: [] })
  fields?: BotLeadField[];
  /** How to ask for missing fields: soft (less frequent), balanced, direct (ask sooner). */
  @Prop({ enum: ['soft', 'balanced', 'direct'], default: undefined })
  askStrategy?: 'soft' | 'balanced' | 'direct';
  @Prop({ default: undefined })
  politeMode?: boolean;
  /** chat = ask in chat; form = avoid aggressive in-chat asking; hybrid = both gently. */
  @Prop({ enum: ['chat', 'form', 'hybrid'], default: undefined })
  captureMode?: 'chat' | 'form' | 'hybrid';
}

export type ChatBackgroundStyle = 'auto' | 'light' | 'dark';
export type ChatLauncherPosition = 'bottom-right' | 'bottom-left';
export type BotVisibility = 'public' | 'private';
export type BotCreatorType = 'user' | 'visitor';
export type BotMessageLimitMode = 'none' | 'fixed_total';

/** Default max embed API requests per minute per IP when not set on the bot document. */
export const DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE = 90;

export function resolveWidgetEmbedRateLimitPerMinute(
  bot: { widgetEmbedRateLimitPerMinute?: unknown } | null | undefined,
): number {
  const v = bot?.widgetEmbedRateLimitPerMinute;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v);
  return DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE;
}
/** Message bubble border radius in pixels (0–32). Affects message bubbles and suggested chips. */
export const BUBBLE_RADIUS_MIN = 0;
export const BUBBLE_RADIUS_MAX = 32;
export type LiveIndicatorStyle = 'label' | 'dot-only';
/** Header status: "live" | "active" | "none". When "none", no status pill/label is shown. */
export type ChatStatusIndicator = 'live' | 'active' | 'none';
/** Where to show message time: "top" (above) or "bottom" (assistant=right, user=left) */
export type ChatTimePosition = 'top' | 'bottom';

@Schema({ _id: false })
export class BotChatUI {
  @Prop({ default: '#14B8A6' })
  primaryColor?: string;
  @Prop({ enum: ['auto', 'light', 'dark'], default: 'light' })
  backgroundStyle?: ChatBackgroundStyle;
  @Prop({ min: 0, max: 32, default: 20 })
  bubbleBorderRadius?: number;
  /** Chat panel outer border width in px when border is shown (0–5, default 1). */
  @Prop({ min: 0, max: 5, default: 1 })
  chatPanelBorderWidth?: number;
  @Prop({ enum: ['bottom-right', 'bottom-left'], default: 'bottom-right' })
  launcherPosition?: ChatLauncherPosition;
  @Prop({ enum: ['none', 'low', 'medium', 'high'], default: 'medium' })
  shadowIntensity?: 'none' | 'low' | 'medium' | 'high';
  @Prop({ default: true })
  showChatBorder?: boolean;
  @Prop({ enum: ['default', 'bot-avatar', 'custom'], default: 'default' })
  launcherIcon?: 'default' | 'bot-avatar' | 'custom';
  @Prop({ default: '' })
  launcherAvatarUrl?: string;
  @Prop({ min: 0, max: 30, default: 18 })
  launcherAvatarRingWidth?: number;
  @Prop({ min: 32, max: 96, default: 48 })
  launcherSize?: number;
  /** Launcher while chat is open: X, down arrow (default), or same as closed */
  @Prop({ enum: ['close', 'chevron-down', 'same'], default: 'chevron-down' })
  launcherWhenOpen?: 'close' | 'chevron-down' | 'same';
  @Prop({ enum: ['slide-up-fade', 'fade', 'expand'], default: 'slide-up-fade' })
  chatOpenAnimation?: 'slide-up-fade' | 'fade' | 'expand';
  @Prop({ default: true })
  openChatOnLoad?: boolean;
  @Prop({ min: 0, max: 6, default: 1 })
  composerBorderWidth?: number;
  @Prop({ enum: ['default', 'primary'], default: 'primary' })
  composerBorderColor?: 'default' | 'primary';
  @Prop({ default: true })
  showBranding?: boolean;
  /** Editable text shown in footer when showBranding is true (e.g. "Powered by ...") */
  @Prop({ default: '' })
  brandingMessage?: string;
  /** When false, hide the privacy/footer line even if privacyText is set (default true). */
  @Prop({ default: true })
  showPrivacyText?: boolean;
  /** Optional second footer line (privacy / legal). Shown when showPrivacyText is true. */
  @Prop({ default: '' })
  privacyText?: string;
  /** How to show the status indicator: "label" = dot + text next to title; "dot-only" = dot on avatar */
  @Prop({ enum: ['label', 'dot-only'], default: 'label' })
  liveIndicatorStyle?: LiveIndicatorStyle;
  /** Header status: "live" | "active" | "none". When "none", no status pill/label is shown. */
  @Prop({ enum: ['live', 'active', 'none'], default: 'none' })
  statusIndicator?: ChatStatusIndicator;
  /** Status dot: "blinking" (animate-pulse) or "static" (default "blinking") */
  @Prop({ enum: ['blinking', 'static'], default: 'blinking' })
  statusDotStyle?: 'blinking' | 'static';
  /** Show scroll-to-bottom button when user scrolls up (default true) */
  @Prop({ default: true })
  showScrollToBottom?: boolean;
  /** When true, show label text beside the scroll-to-bottom arrow (default true). */
  @Prop({ default: true })
  showScrollToBottomLabel?: boolean;
  /** Custom scroll-to-bottom label; empty string uses widget default copy. */
  @Prop({ default: '' })
  scrollToBottomLabel?: string;
  /** Show scrollbar in message list (default true). When false, scrollbar is hidden but content still scrolls. */
  @Prop({ default: true })
  showScrollbar?: boolean;
  /** When true, message input is a separate box (border-top + bg). When false, no border and no bg (default true). */
  @Prop({ default: true })
  composerAsSeparateBox?: boolean;
  /** Show "Expand chat" option in header menu (default true) */
  @Prop({ default: true })
  showMenuExpand?: boolean;
  /** When false, hide the quick links header control (default true). */
  @Prop({ default: true })
  showMenuQuickLinks?: boolean;
  /** Quick links in header menu (max 10): text + route + optional icon id */
  @Prop({
    type: [
      {
        text: { type: String, required: true },
        route: { type: String, required: true },
        icon: { type: String, required: false },
      },
    ],
    default: [],
  })
  menuQuickLinks?: Array<{ text: string; route: string; icon?: string }>;
  /** Icon id for the header control that opens the quick links menu (default link-2). */
  @Prop({ type: String, required: false })
  menuQuickLinksMenuIcon?: string;
  /** When true, show chat input with suggested questions on first message. When false, only quick-question chips until user picks one (default false). */
  @Prop({ default: false })
  showComposerWithSuggestedQuestions?: boolean;
  /** Show bot avatar in chat header (default true) */
  @Prop({ default: true })
  showAvatarInHeader?: boolean;
  /** Display name for assistant/sender (e.g. "Bot Name - AI"). Empty = use bot name + " - AI". */
  @Prop({ default: '' })
  senderName?: string;
  /** Show sender/assistant name above messages (default true) */
  @Prop({ default: true })
  showSenderName?: boolean;
  /** Show message time in metadata (default true) */
  @Prop({ default: true })
  showTime?: boolean;
  /** Show copy button on assistant messages (default true) */
  @Prop({ default: true })
  showCopyButton?: boolean;
  /** Show sources on assistant messages (default true) */
  @Prop({ default: true })
  showSources?: boolean;
  /** Where to show time: "top" (above message) or "bottom" (assistant=right, user=left) */
  @Prop({ enum: ['top', 'bottom'], default: 'top' })
  timePosition?: ChatTimePosition;
  /** Show emoji picker button in composer (default true) */
  @Prop({ default: true })
  showEmoji?: boolean;
  /** Allow file uploads in chat (Integration; consumes more GPT) */
  @Prop({ default: false })
  allowFileUpload?: boolean;
  /** Show mic button; when true, Whisper API key or config required in Integrations */
  @Prop({ default: false })
  showMic?: boolean;
}

const BEHAVIOR_PRESET_VALUES = [
  'default', 'support', 'sales', 'technical', 'marketing',
  'consultative', 'teacher', 'empathetic', 'strict',
] as const;

@Schema({ _id: false })
export class BotPersonality {
  @Prop()
  name?: string;
  @Prop()
  description?: string;
  /** Optional response behavior rules (how to answer). Use for tone/style; do not put company facts (pricing, hours, policies) here—those come from knowledge/retrieval. */
  @Prop()
  systemPrompt?: string;
  /** UI behavior preset key (e.g. default, support, sales). Persisted so dropdown reflects after reload. */
  @Prop({ enum: BEHAVIOR_PRESET_VALUES })
  behaviorPreset?: string;
  @Prop({ enum: ['friendly', 'formal', 'playful', 'technical'] })
  tone?: string;
  @Prop()
  language?: string;
  /** Things the bot should avoid (topics, behaviours). Shown to the model as part of behaviour context. */
  @Prop()
  thingsToAvoid?: string;
}

@Schema({ _id: false })
export class BotConfig {
  @Prop({ min: 0, max: 1 })
  temperature?: number;
  @Prop()
  maxTokens?: number;
  @Prop({ enum: ['short', 'medium', 'long'] })
  responseLength?: string;
}

@Schema({ timestamps: false })
export class Bot {
  @Prop({ required: true })
  name: string;
  @Prop({ required: true, unique: true, lowercase: true })
  slug: string;
  @Prop({ required: true, enum: ['showcase', 'visitor-own'] })
  type: string;
  /**
   * External access visibility gate.
   * Default is "public" to preserve current behavior for existing creation flows.
   */
  @Prop({ enum: ['public', 'private'], default: 'public', index: true })
  visibility?: BotVisibility;
  /** Public-ish access credential used by external clients. */
  @Prop({ required: true, unique: true, index: true, default: generateBotAccessKey })
  accessKey: string;
  /** Private credential for secure/private access modes (never expose via public APIs). */
  @Prop({ required: true, default: generateBotSecretKey })
  secretKey: string;
  /** Distinguishes authenticated-user-created bots from visitor-created bots. */
  @Prop({ enum: ['user', 'visitor'], default: 'user', index: true })
  creatorType?: BotCreatorType;
  /** Owner platform user (separate from createdByUserId for access ownership semantics). */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  ownerUserId?: Types.ObjectId;
  @Prop()
  ownerVisitorId?: string;
  /** Platform user who created this bot (showcase flows from the admin app). */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdByUserId?: Types.ObjectId;
  @Prop({ default: false })
  isPublic: boolean;
  @Prop()
  shortDescription?: string;
  /** @deprecated Identity is now in the behavior/identity layer; bot name is always applied in system prompt. Kept for backward compatibility. */
  @Prop({ default: false })
  includeNameInKnowledge?: boolean;
  /** @deprecated Tagline is not injected into knowledge layer anymore. Kept for backward compatibility. */
  @Prop({ default: false })
  includeTaglineInKnowledge?: boolean;
  /** When false, KnowledgeBaseItem sourceType='note' is excluded from RAG retrieval. */
  @Prop({ default: true })
  includeNotesInKnowledge?: boolean;
  @Prop()
  category?: string;
  @Prop({ type: [String], default: [] })
  categories?: string[];
  @Prop()
  avatarEmoji?: string;
  @Prop()
  imageUrl?: string;
  @Prop()
  openaiApiKeyOverride?: string;
  /** Whisper API key for voice input when chatUI.showMic is true (e.g. OpenAI key or Whisper endpoint key). */
  @Prop()
  whisperApiKeyOverride?: string;
  @Prop()
  limitOverrideMessages?: number;
  /** Bot-level usage policy mode; step-1 prepares storage only (no runtime enforcement yet). */
  @Prop({ enum: ['none', 'fixed_total'], default: 'none' })
  messageLimitMode?: BotMessageLimitMode;
  /** Total allowed messages when messageLimitMode='fixed_total'. Null/undefined means unlimited. */
  @Prop({ type: Number, default: null })
  messageLimitTotal?: number | null;
  /** Custom upgrade/upsell copy shown when bot-level quota is reached. */
  @Prop({ type: String, default: null })
  messageLimitUpgradeMessage?: string | null;
  /**
   * When true, embed visitors may keep multiple chat threads (start new / recent chats).
   * When false, one conversation per chatVisitorId (legacy).
   */
  @Prop({ default: false })
  visitorMultiChatEnabled?: boolean;
  /**
   * Max concurrent saved threads per embed visitor when visitorMultiChatEnabled is true.
   * null/undefined = unlimited.
   */
  @Prop({ type: Number, default: null })
  visitorMultiChatMax?: number | null;
  @Prop()
  clientDraftId?: string;
  @Prop({ enum: ['draft', 'published'], default: 'draft', index: true })
  status?: string;
  @Prop()
  welcomeMessage?: string;
  @Prop({ type: BotLeadCaptureV2, default: () => ({}) })
  leadCapture?: BotLeadCaptureV2;
  @Prop({ type: BotChatUI, default: () => ({}) })
  chatUI?: BotChatUI;
  @Prop()
  description?: string;
  @Prop({ type: [String], default: [] })
  exampleQuestions?: string[];
  @Prop({ type: BotPersonality })
  personality?: BotPersonality;
  @Prop({ type: BotConfig })
  config?: BotConfig;
  /** Tenant workspace for showcase bots (multi-user edit via membership). */
  @Prop({ type: Types.ObjectId, ref: 'Workspace', index: true })
  workspaceId?: Types.ObjectId;
  /**
   * Runtime embed allowlist. Each entry is either a hostname (domain mode: includes subdomains)
   * or `exact:<canonicalOrigin>` for a single origin (scheme + host + port).
   */
  @Prop({ type: [String], default: [] })
  allowedDomains?: string[];
  /**
   * Max combined embed requests per minute per IP for this bot (widget init + gated chat).
   * `0` = disabled. Not exposed in the admin UI yet; set on the document (e.g. DB) when needed.
   */
  @Prop({ type: Number, min: 0, default: DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE })
  widgetEmbedRateLimitPerMinute?: number;
  @Prop({ default: Date.now })
  createdAt: Date;
}

export const BotSchema = SchemaFactory.createForClass(Bot);
BotSchema.index(
  { clientDraftId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'draft',
      type: 'showcase',
      clientDraftId: { $type: 'string' },
    },
  },
);
