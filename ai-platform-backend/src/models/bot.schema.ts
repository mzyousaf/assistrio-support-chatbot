import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';
import { generateBotAccessKey, generateBotSecretKey } from '../bots/bot-keys.util';
import { DEFAULT_BOT_KNOWLEDGE_SIZE } from '../knowledge/knowledge-plan-limits';
import {
  BotKnowledgeStats,
  BotKnowledgeStatsSchema,
  BotKnowledgeTrainingSettings,
  BotKnowledgeTrainingSettingsSchema,
} from './bot-knowledge-stats.schema';
import {
  DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS,
  KB_REPLY_PRIORITY_SOURCE_TYPES,
} from '../knowledge/knowledge-reply-priority.util';

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
export type BotTranslationMode = 'english_only' | 'auto' | 'fixed';

/** Default max embed API requests per minute per IP when not set on the bot document. */
export const DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE = 90;

export function resolveWidgetEmbedRateLimitPerMinute(
  bot: { widgetEmbedRateLimitPerMinute?: unknown } | null | undefined,
): number {
  const v = bot?.widgetEmbedRateLimitPerMinute;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v);
  return DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE;
}

@Schema({ _id: false })
export class BotAllowedOrigin {
  @Prop({ required: true })
  origin: string;
  @Prop()
  label?: string;
  @Prop({ default: true })
  isActive?: boolean;
}

/** Hosted share-link settings (`/share/:slug` on customer app). */
@Schema({ _id: false })
export class BotShareChat {
  @Prop({ default: false })
  enabled?: boolean;
  @Prop({ trim: true, lowercase: true })
  slug?: string;
  @Prop()
  tokenHash?: string;
  /** AES-GCM ciphertext (base64url); owner APIs decrypt for display only. */
  @Prop()
  encryptedPreviewToken?: string;
  @Prop({ type: Date, required: false })
  expiresAt?: Date | null;
  /** When set, preview link was revoked; public access must fail. */
  @Prop({ type: Date, required: false })
  tokenRevokedAt?: Date | null;
  @Prop({ default: false })
  allowDraft?: boolean;
  @Prop()
  createdAt?: Date;
  @Prop()
  updatedAt?: Date;
}

const BotShareChatSchema = SchemaFactory.createForClass(BotShareChat);

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
  /** Panel outline: neutral gray vs brand when border is shown (default `primary`). */
  @Prop({ enum: ['default', 'primary'], default: 'primary' })
  chatPanelBorderColor?: 'default' | 'primary';
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
  /** Send + voice controls: brand fill, neutral, or dark chip (default matches legacy accent-on). */
  @Prop({ enum: ['brand', 'default', 'defaultDark'], default: 'defaultDark' })
  composerControlStyle?: 'brand' | 'default' | 'defaultDark';
  /** @deprecated Use composerControlStyle. */
  @Prop({ required: false })
  composerControlsUsePrimary?: boolean;
  /** Live recording level meter in composer. */
  @Prop({ enum: ['brand', 'default', 'defaultDark'], default: 'default' })
  speechRecordingWaveStyle?: 'brand' | 'default' | 'defaultDark';
  @Prop({ default: true })
  showBranding?: boolean;
  /** Logo + “Powered by Assistrio” above composer before first visitor message (default true). */
  @Prop({ default: true })
  showAssistrioBrandingPaid?: boolean;
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
  /** Message list scrollbar thumb. Legacy `gray` maps on read. */
  @Prop({ enum: ['default', 'defaultDark', 'primary', 'gray'], default: 'default' })
  scrollChromeStyle?: 'default' | 'defaultDark' | 'primary' | 'gray';
  /** Floating scroll-to-latest button; when unset, matches `scrollChromeStyle`. */
  @Prop({ enum: ['default', 'defaultDark', 'primary', 'gray'], required: false })
  scrollToBottomChromeStyle?: 'default' | 'defaultDark' | 'primary' | 'gray';
  /** Floating scroll-to-latest button horizontal alignment (default center). */
  @Prop({ enum: ['left', 'center', 'right'], default: 'center' })
  scrollToBottomAlign?: 'left' | 'center' | 'right';
  /** @deprecated Use scrollChromeStyle. */
  @Prop({ required: false })
  scrollChromeUsesPrimary?: boolean;
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
  /**
   * When true, suggestion chips stay tappable but hide visible label text (accessibility text preserved).
   * Does not change “Use in replies” on knowledge items.
   */
  @Prop({ default: false })
  hideSuggestionChipText?: boolean;
  /** Show bot avatar in chat header (default true) */
  @Prop({ default: true })
  showAvatarInHeader?: boolean;
  /** @deprecated Widget no longer shows sender line in-thread. */
  @Prop({ default: '' })
  senderName?: string;
  /** @deprecated Widget no longer shows sender line in-thread. */
  @Prop({ default: true })
  showSenderName?: boolean;
  /** @deprecated Widget no longer shows timestamps in-thread. */
  @Prop({ default: true })
  showTime?: boolean;
  /** Show copy button on assistant messages (default true) */
  @Prop({ default: true })
  showCopyButton?: boolean;
  /** Thumbs up/down on assistant replies (default true). */
  @Prop({ default: true })
  showMessageFeedback?: boolean;
  /** Visitor text bubbles: primary, neutral, or black (default primary). */
  @Prop({ enum: ['primary', 'default', 'defaultDark'], default: 'primary' })
  userTextBubbleStyle?: 'primary' | 'default' | 'defaultDark';
  /** Visitor voice bubbles: primary, neutral, or black (default primary). */
  @Prop({ enum: ['primary', 'default', 'defaultDark'], default: 'primary' })
  userVoiceBubbleStyle?: 'primary' | 'default' | 'defaultDark';
  /**
   * When true, workspace preview may show citation sources on replies.
   * Live embed does not surface sources to visitors.
   */
  @Prop({ default: false })
  showSources?: boolean;
  /** Where to show time: "top" (above message) or "bottom" (assistant=right, user=left) */
  @Prop({ enum: ['top', 'bottom'], default: 'top' })
  timePosition?: ChatTimePosition;
  /** Allow file uploads in the widget composer (configured in customer AI & Advanced / admin Integrations & AI). */
  @Prop({ default: false })
  allowFileUpload?: boolean;
  /** Dictate / microphone control in the composer. */
  @Prop({ default: false })
  showMic?: boolean;
  /** Voice (waveform) control in the composer. If omitted on legacy bots, treated like showMic. */
  @Prop({ default: false })
  showVoice?: boolean;
}

const BEHAVIOR_PRESET_VALUES = [
  'default', 'support', 'sales', 'technical', 'marketing',
  'consultative', 'teacher', 'empathetic', 'strict',
  'concise', 'creative', 'research', 'executive', 'hospitality',
  'coach', 'analyst', 'storyteller', 'startup', 'journalistic',
  'companion', 'simplifier', 'facilitator', 'advocate', 'negotiator', 'interviewer',
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
  @Prop({
    enum: [
      'friendly', 'warm', 'supportive', 'empathetic', 'professional', 'formal',
      'confident', 'authoritative', 'casual', 'conversational', 'playful', 'enthusiastic',
      'neutral', 'diplomatic', 'direct', 'patient', 'calm', 'technical',
    ],
  })
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
  /** `free` = user-written instructions; `structured` = backend-refined locked format. */
  @Prop({ enum: ['free', 'structured'] })
  responseStyleMode?: 'free' | 'structured';
  /** Customer-defined output style (formatting/tone); subordinate to grounding and safety. */
  @Prop()
  responseStyleInstructions?: string;
  /** Original natural-language description (structured mode only). */
  @Prop()
  responseStyleDescription?: string;
  /** ISO timestamp when structured instructions were last refined/saved. */
  @Prop()
  responseStyleRefinedAt?: string;
  /** `knowledge_first` (default) vs strict `knowledge_only` grounding for answers. */
  @Prop({ enum: ['knowledge_first', 'knowledge_only'], default: 'knowledge_first' })
  answerMode?: 'knowledge_first' | 'knowledge_only';
}

@Schema({ _id: false })
export class BotTranslationSettings {
  @Prop({ default: false })
  enabled?: boolean;

  @Prop({ enum: ['english_only', 'auto', 'fixed'], default: 'english_only' })
  mode?: BotTranslationMode;

  @Prop()
  fixedLanguage?: string;

  @Prop({ enum: ['english'], default: 'english' })
  transcriptLanguage?: 'english';
}

@Schema({ _id: false })
export class BotKnowledgeSizeConfig {
  @Prop({ enum: ['default', 'paid_addon', 'custom'], default: 'default' })
  type?: 'default' | 'paid_addon' | 'custom';

  @Prop({ type: Number, default: DEFAULT_BOT_KNOWLEDGE_SIZE.baseMaxBytes })
  baseMaxBytes?: number;

  @Prop({ type: Number, default: DEFAULT_BOT_KNOWLEDGE_SIZE.extraMaxBytes })
  extraMaxBytes?: number;

  @Prop({ type: Number, default: DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes })
  maxBytes?: number;

  @Prop({ type: Date, default: null })
  lastPaidAt?: Date | null;

  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  updatedAt?: Date | null;

  @Prop({ type: String, default: null })
  updatedBy?: string | null;

  @Prop({ type: String, default: null })
  note?: string | null;
}

export const BotKnowledgeSizeConfigSchema = SchemaFactory.createForClass(BotKnowledgeSizeConfig);

/**
 * Platform-owned bot settings (not customer-editable via workspace PATCH).
 * Customer payloads must never map into this object.
 */
@Schema({ _id: false })
export class BotPlanConfig {
  @Prop({
    type: BotKnowledgeSizeConfigSchema,
    default: () => ({ ...DEFAULT_BOT_KNOWLEDGE_SIZE }),
  })
  knowledgeSize?: BotKnowledgeSizeConfig;
}

export const BotPlanConfigSchema = SchemaFactory.createForClass(BotPlanConfig);

@Schema({ _id: false })
export class BotKnowledgeReplyPrioritySettings {
  @Prop({ enum: ['default', 'priority'], default: DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS.mode })
  mode?: 'default' | 'priority';

  @Prop({ type: [String], enum: [...KB_REPLY_PRIORITY_SOURCE_TYPES], default: () => [...KB_REPLY_PRIORITY_SOURCE_TYPES] })
  sourceOrder?: Array<'faq' | 'note' | 'table' | 'document' | 'suggestion'>;
}

export const BotKnowledgeReplyPrioritySettingsSchema = SchemaFactory.createForClass(
  BotKnowledgeReplyPrioritySettings,
);

/** Workspace member access to this bot in the customer app (list visibility + playground preview). */
@Schema({ _id: false })
export class BotWorkspaceMemberVisibility {
  /** When false, workspace members do not see this bot in /bots or open its workspace. */
  @Prop({ default: true })
  visibleToMembers?: boolean;

  /** When false, members may view settings read-only but cannot use playground/preview chat. */
  @Prop({ default: true })
  allowMemberPreview?: boolean;
}

export const BotWorkspaceMemberVisibilitySchema = SchemaFactory.createForClass(BotWorkspaceMemberVisibility);

@Schema({ timestamps: false })
export class Bot {
  @Prop({ required: true })
  name: string;
  @Prop({ required: true, unique: true, lowercase: true })
  slug: string;
  /**
   * True when created via the superadmin “agents pack” generator (caps and bulk delete UX).
   */
  @Prop({ default: false })
  agentsPackAgent?: boolean;
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
  /** Owner workspace user — sole ownership source for preview and admin access checks. */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  ownerId?: Types.ObjectId;
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
  /** How the workspace chose the avatar: uploaded file, external URL, emoji, or none. */
  @Prop({ enum: ['upload', 'url', 'emoji', 'none'], default: undefined })
  avatarSource?: 'upload' | 'url' | 'emoji' | 'none';
  @Prop()
  openaiApiKeyOverride?: string;
  /** Whisper API key when chatUI.showMic or chatUI.showVoice is true (e.g. OpenAI key or Whisper endpoint key). */
  @Prop()
  whisperApiKeyOverride?: string;
  @Prop()
  limitOverrideMessages?: number;
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
  /** When false, welcome text is kept but not shown in the widget or seeded into new threads. */
  @Prop({ default: true })
  welcomeMessageEnabled?: boolean;
  @Prop({ type: BotLeadCaptureV2, default: () => ({}) })
  leadCapture?: BotLeadCaptureV2;
  @Prop({ type: BotChatUI, default: () => ({}) })
  chatUI?: BotChatUI;
  @Prop()
  description?: string;
  /** Legacy: `string[]`. New: `{ label, context? }[]` — optional `context` scopes the first reply when that chip is used. */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  exampleQuestions?: unknown[];
  @Prop({ type: BotPersonality })
  personality?: BotPersonality;
  @Prop({ type: BotConfig })
  config?: BotConfig;
  @Prop({
    type: BotTranslationSettings,
    default: () => ({ enabled: false, mode: 'english_only', transcriptLanguage: 'english' }),
  })
  translationSettings?: BotTranslationSettings;
  /**
   * Internal plan / quota fields. Omitted on legacy documents — use `resolveBotKnowledgeSizeConfig`.
   */
  @Prop({
    type: BotPlanConfigSchema,
    default: () => ({ knowledgeSize: { ...DEFAULT_BOT_KNOWLEDGE_SIZE } }),
  })
  botConfig?: BotPlanConfig;
  /**
   * Assistrio-owned bot (landing demos, showcase, support, internal). Stored on the normal `Bot` collection.
   */
  @Prop({ default: false, index: true })
  isPlatformBot?: boolean;
  @Prop({ enum: ['landing_demo', 'showcase', 'support', 'internal'] })
  platformBotType?: 'landing_demo' | 'showcase' | 'support' | 'internal';
  /** Tenant workspace for showcase bots (multi-user edit via membership). */
  @Prop({ type: Types.ObjectId, ref: 'Workspace', index: true })
  workspaceId?: Types.ObjectId;

  /**
   * Member list/preview access (owner/admin always have full access).
   * Defaults preserve backward compatibility: members see and can preview all bots.
   */
  @Prop({
    type: BotWorkspaceMemberVisibilitySchema,
    default: () => ({ visibleToMembers: true, allowMemberPreview: true }),
  })
  workspaceMemberVisibility?: BotWorkspaceMemberVisibility;
  /**
   * Runtime embed allowlist: exact origins only (`https://host[:port]`). Inactive rows are ignored.
   */
  @Prop({ type: [BotAllowedOrigin], default: [] })
  allowedOrigins?: BotAllowedOrigin[];
  /**
   * Max combined embed requests per minute per IP for this bot (widget init + gated chat).
   * `0` = disabled. Not exposed in the admin UI yet; set on the document (e.g. DB) when needed.
   */
  @Prop({ type: Number, min: 0, default: DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE })
  widgetEmbedRateLimitPerMinute?: number;

  /** Hosted share-link settings (public chat page on Assistrio customer app). */
  @Prop({ type: BotShareChatSchema, default: () => ({}) })
  shareChat?: BotShareChat;

  @Prop({ type: BotKnowledgeStatsSchema })
  knowledgeStats?: BotKnowledgeStats;

  @Prop({
    type: BotKnowledgeTrainingSettingsSchema,
    default: () => ({ autoTrainEnabled: false, trainingDelayMinutes: 5, scheduleMode: 'smart' }),
  })
  knowledgeTraining?: BotKnowledgeTrainingSettings;

  @Prop({
    type: BotKnowledgeReplyPrioritySettingsSchema,
    default: () => ({ ...DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS }),
  })
  knowledgeReplyPriority?: BotKnowledgeReplyPrioritySettings;

  @Prop({ default: Date.now })
  createdAt: Date;

  /**
   * When false with {@link deletedAt}, the bot is soft-deleted: hidden from lists, widget/chat blocked,
   * knowledge cascaded soft-deleted; hard removal runs later via scheduled purge.
   */
  @Prop({ default: true })
  active?: boolean;

  /** User- / system-initiated delete time — bot row stays until bot purge cron hard-deletes. */
  @Prop()
  deletedAt?: Date;
}

export const BotSchema = SchemaFactory.createForClass(Bot);
BotSchema.index({ deletedAt: 1, active: 1 });
BotSchema.index(
  { 'shareChat.slug': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'shareChat.slug': { $exists: true, $type: 'string', $gt: '' },
    },
  },
);
BotSchema.index(
  { clientDraftId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'draft',
      clientDraftId: { $type: 'string' },
    },
  },
);
