import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Stored lead field values captured during the conversation.
 * Keys match bot leadCapture.fields[].key; values are strings from user input.
 */
export type CapturedLeadData = Record<string, string>;

export type ConversationOriginSource =
  | 'script_embed'
  | 'iframe_embed'
  | 'shared_link'
  | 'widget_preview'
  | 'playground_preview'
  | 'shared_preview'
  | 'unknown';

/** Product-normalized entry surface (optional; sessionSource remains canonical for legacy rows). */
export type ConversationStartedFrom =
  | 'playground_preview'
  | 'shared_preview'
  | 'runtime_widget'
  | 'runtime_iframe'
  | 'unknown';

export type ConversationAnalyticsStatus = 'active' | 'closed' | 'abandoned';

/** Lightweight attribution for future analytics (iframe / share / embed). */
@Schema({ _id: false })
export class ConversationOrigin {
  @Prop({
    enum: [
      'script_embed',
      'iframe_embed',
      'shared_link',
      'widget_preview',
      'playground_preview',
      'shared_preview',
      'unknown',
    ],
  })
  source?: ConversationOriginSource;

  /** High-level channel mode: Assistrio-hosted preview vs customer-site runtime. */
  @Prop({ enum: ['preview', 'runtime'] })
  mode?: 'preview' | 'runtime';

  /** UI / transport surface (e.g. `assistrio_share_page`, `iframe`). */
  @Prop()
  surface?: string;

  /** Embed transport hint (e.g. script, iframe). */
  @Prop()
  embedType?: string;

  @Prop()
  pageUrl?: string;

  @Prop()
  referrer?: string;

  /** Origin string from client when distinct from websiteOrigin. */
  @Prop()
  origin?: string;

  /** Customer site / top-level origin (e.g. https://example.com). */
  @Prop()
  websiteOrigin?: string;

  @Prop()
  parentOrigin?: string;

  @Prop()
  shareSlug?: string;

  @Prop()
  iframeUrl?: string;

  @Prop()
  sharedUrl?: string;

  /** Non-reversible hash of User-Agent for analytics (raw UA not stored here). */
  @Prop()
  userAgentHash?: string;
}

@Schema({ _id: false })
export class ConversationLocation {
  @Prop()
  country?: string;

  @Prop()
  countryCode?: string;

  @Prop()
  region?: string;

  @Prop()
  city?: string;

  @Prop()
  timezone?: string;

  /** Non-reversible hash of client IP; raw IP is not stored on this subdocument. */
  @Prop()
  ipHash?: string;

  @Prop()
  latitudeApprox?: number;

  @Prop()
  longitudeApprox?: number;

  /** e.g. ip_lookup, browser_timezone, unknown */
  @Prop()
  source?: string;
}

@Schema({ _id: false })
export class ConversationDeviceInfo {
  @Prop({ enum: ['desktop', 'mobile', 'tablet', 'bot', 'unknown'] })
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

  @Prop()
  browser?: string;

  @Prop()
  browserVersion?: string;

  @Prop()
  os?: string;

  @Prop()
  osVersion?: string;

  @Prop()
  screenWidth?: number;

  @Prop()
  screenHeight?: number;

  @Prop()
  language?: string;

  @Prop()
  userAgentHash?: string;
}

@Schema({ _id: false })
export class ConversationTopicsSummary {
  @Prop()
  primaryTopic?: string;

  @Prop({ type: [String], default: undefined })
  topicLabels?: string[];

  @Prop()
  primarySubTopic?: string;

  @Prop({ type: [String], default: undefined })
  subTopicLabels?: string[];
}

@Schema({ _id: false })
export class ConversationSentimentSummary {
  @Prop({ enum: ['positive', 'neutral', 'negative', 'mixed', 'unknown'] })
  label?: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';

  @Prop()
  score?: number;
}

/** Optional meta for lead capture repetition control. */
export interface LeadCaptureMeta {
  /** Field key we last asked for (e.g. "email"). */
  lastAskedField?: string;
  /** When we last asked for a lead field. */
  lastAskedAt?: Date;
  /** Conversation message count when we last asked (for min-messages cooldown). */
  lastAskedMessageCount?: number;
  /** Fields the user clearly declined; long cooldown before asking again. */
  declinedFields?: string[];
  /** Fields the user postponed ("later", "not now"); shorter cooldown, can re-ask. */
  postponedFields?: string[];
}

@Schema({ timestamps: false })
export class Conversation {
  @Prop({ type: Types.ObjectId, ref: 'Workspace' })
  workspaceId?: Types.ObjectId;

  /** Billing / account user when useful for analytics denormalization (optional). */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  customerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  /**
   * Chat identity for Conversation history + message association.
   * This must come from the embedded widget's chat visitor (chatVisitorId).
   */
  @Prop({ required: true })
  chatVisitorId: string;

  /**
   * Optional analytics session id (correlation); distinct from chatVisitorId when populated.
   */
  @Prop()
  sessionId?: string;

  /**
   * @deprecated Platform visitor id (legacy). Kept temporarily so existing visitor/quota logic can keep working.
   * During migration we store platformVisitorId here while Conversation uses chatVisitorId.
   */
  @Prop()
  visitorId?: string;
  @Prop({ default: Date.now })
  createdAt: Date;
  /** When the conversation thread was first opened (analytics; may mirror createdAt when set). */
  @Prop()
  startedAt?: Date;
  /** Updated on each message for ordering “recent” threads (multi-chat). */
  @Prop({ default: Date.now })
  lastActivityAt?: Date;
  /** Last message timestamp (any role); optional explicit analytics mirror of activity. */
  @Prop()
  lastMessageAt?: Date;
  @Prop()
  firstUserMessageAt?: Date;
  @Prop()
  lastUserMessageAt?: Date;
  @Prop()
  lastAssistantMessageAt?: Date;
  @Prop()
  endedAt?: Date;

  @Prop({ enum: ['active', 'closed', 'abandoned'], default: 'active' })
  status?: ConversationAnalyticsStatus;

  /** Lead capture: field key -> value collected from this conversation. */
  @Prop({ type: Object, default: undefined })
  capturedLeadData?: CapturedLeadData;
  /** Lead capture repetition control; optional, backward-compatible. */
  @Prop({ type: Object, default: undefined })
  leadCaptureMeta?: LeadCaptureMeta;
  /** Optional short summary for long conversations (future summarization pipeline). */
  @Prop({ default: undefined })
  summary?: string;
  /**
   * Where this conversation was created. `widget_preview` = admin editor preview (persists like runtime; filter in analytics).
   * Omitted on older rows = treat as runtime.
   */
  @Prop({
    enum: ['runtime', 'widget_preview', 'shared_link', 'shared_preview', 'iframe_embed'],
    default: 'runtime',
  })
  sessionSource?: 'runtime' | 'widget_preview' | 'shared_link' | 'shared_preview' | 'iframe_embed';

  /**
   * Normalized product label for dashboards; optional on legacy documents.
   */
  @Prop({
    enum: ['playground_preview', 'shared_preview', 'runtime_widget', 'runtime_iframe', 'unknown'],
  })
  startedFrom?: ConversationStartedFrom;

  @Prop({ type: ConversationOrigin, required: false })
  conversationOrigin?: ConversationOrigin;

  @Prop({ type: ConversationLocation, required: false })
  location?: ConversationLocation;

  @Prop({ type: ConversationDeviceInfo, required: false })
  deviceInfo?: ConversationDeviceInfo;

  /** Admin user who started this preview session (`sessionSource: widget_preview` only). */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  previewInitiatedByUserId?: Types.ObjectId;

  // --- Analytics counters (maintained by future capture pipeline; defaults apply on new saves) ---
  @Prop({ default: 0 })
  totalUserMessages?: number;
  @Prop({ default: 0 })
  totalAssistantMessages?: number;
  @Prop({ default: 0 })
  totalMessages?: number;
  @Prop({ default: 0 })
  textMessageCount?: number;
  @Prop({ default: 0 })
  voiceMessageCount?: number;
  @Prop({ default: 0 })
  dictationMessageCount?: number;
  @Prop({ default: 0 })
  attachmentMessageCount?: number;
  @Prop({ default: 0 })
  quickReplyMessageCount?: number;
  @Prop({ default: 0 })
  suggestedQuestionMessageCount?: number;
  @Prop({ default: 0 })
  totalCreditsUsed?: number;
  @Prop({ default: 0 })
  sourcesUsedCount?: number;

  @Prop({ default: false })
  hasLead?: boolean;
  @Prop({ default: false })
  hasVoice?: boolean;
  @Prop({ default: false })
  hasDictation?: boolean;
  @Prop({ default: false })
  hasAttachment?: boolean;

  @Prop()
  leadCapturedAt?: Date;
  /** Per field key: visitor message that last set that captured value (provenance for lead UI). */
  @Prop({ type: Object, default: undefined })
  capturedLeadFieldMessageIds?: Record<string, Types.ObjectId>;

  @Prop({ type: [String], default: undefined })
  leadFieldKeys?: string[];
  @Prop({ type: Types.ObjectId, ref: 'Message' })
  leadSourceMessageId?: Types.ObjectId;

  @Prop({ type: ConversationTopicsSummary, required: false })
  conversationTopics?: ConversationTopicsSummary;

  @Prop({ type: ConversationSentimentSummary, required: false })
  conversationSentiment?: ConversationSentimentSummary;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ botId: 1, createdAt: -1 });
ConversationSchema.index({ botId: 1, startedAt: -1 }, { sparse: true });
ConversationSchema.index({ botId: 1, startedFrom: 1 }, { sparse: true });
ConversationSchema.index({ botId: 1, hasLead: 1 });
ConversationSchema.index({ botId: 1, 'location.countryCode': 1 }, { sparse: true });
ConversationSchema.index({ botId: 1, 'deviceInfo.deviceType': 1 }, { sparse: true });
ConversationSchema.index({ botId: 1, visitorId: 1 }, { sparse: true });
