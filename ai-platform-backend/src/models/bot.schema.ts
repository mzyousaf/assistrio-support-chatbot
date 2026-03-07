import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

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
}

@Schema({ _id: false })
export class BotLeadCaptureV2 {
  @Prop({ default: false })
  enabled?: boolean;
  @Prop({ type: [BotLeadField], default: [] })
  fields?: BotLeadField[];
}

export type ChatBackgroundStyle = 'auto' | 'light' | 'dark';
export type ChatLauncherPosition = 'bottom-right' | 'bottom-left';
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
  @Prop({ enum: ['bottom-right', 'bottom-left'], default: 'bottom-right' })
  launcherPosition?: ChatLauncherPosition;
  @Prop({ default: true })
  showBranding?: boolean;
  /** Editable text shown in footer when showBranding is true (e.g. "Powered by ...") */
  @Prop({ default: '' })
  brandingMessage?: string;
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
  /** When true, message input is a separate box (border-top + bg). When false, no border and no bg (default true). */
  @Prop({ default: true })
  composerAsSeparateBox?: boolean;
  /** Show "Expand chat" option in header menu (default true) */
  @Prop({ default: true })
  showMenuExpand?: boolean;
  /** Quick links in header menu (max 3): text + route */
  @Prop({ type: [{ text: String, route: String }], default: [] })
  menuQuickLinks?: Array<{ text: string; route: string }>;
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

@Schema({ _id: false })
export class BotFaq {
  @Prop({ required: true })
  question: string;
  @Prop({ required: true })
  answer: string;
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
  @Prop()
  ownerVisitorId?: string;
  @Prop({ default: false })
  isPublic: boolean;
  @Prop()
  shortDescription?: string;
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
  @Prop()
  knowledgeDescription?: string;
  @Prop({ type: [BotFaq], default: [] })
  faqs?: BotFaq[];
  @Prop({ type: [String], default: [] })
  exampleQuestions?: string[];
  @Prop({ type: BotPersonality })
  personality?: BotPersonality;
  @Prop({ type: BotConfig })
  config?: BotConfig;
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
