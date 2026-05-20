import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** Visitor-uploaded file sent with a user message (widget composer). */
@Schema({ _id: false })
export class MessageAttachment {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  mimeType: string;

  /** Public URL after S3 upload. */
  @Prop({ required: true })
  url: string;

  @Prop()
  size?: number;
}

/** User message speech metadata (dictate vs voice message); transcript from Whisper. */
@Schema({ _id: false })
export class MessageSpeechInput {
  @Prop({ required: true, enum: ['dictate', 'voice'] })
  mode: 'dictate' | 'voice';

  /** Whisper transcript (required for voice UX; optional echo for dictate). */
  @Prop()
  transcript?: string;

  /** Public URL after S3 upload (voice messages). */
  @Prop()
  audioUrl?: string;

  @Prop()
  mimeType?: string;

  @Prop()
  durationMs?: number;

  /** Original recorded blob size (bytes) for analytics when available. */
  @Prop()
  audioSizeBytes?: number;

  /** Dictation session length (ms), client-reported for analytics. */
  @Prop()
  dictationDurationMs?: number;

  @Prop({ enum: ['browser_speech_recognition', 'whisper'] })
  dictationProvider?: 'browser_speech_recognition' | 'whisper';
}

export type MessageInputType =
  | 'text'
  | 'voice'
  | 'dictation'
  | 'attachment'
  | 'quick_reply'
  | 'suggested_question'
  | 'welcome'
  | 'unknown';

export type MessageInputMethod =
  | 'keyboard'
  | 'microphone'
  | 'microphone_transcription'
  | 'browser_speech_recognition'
  | 'file_upload'
  | 'quick_reply'
  | 'suggested_question'
  | 'api'
  | 'unknown';

/** RAG / knowledge source reference on assistant messages (legacy + extended fields). */
@Schema({ _id: false })
export class MessageSource {
  @Prop()
  chunkId?: string;

  @Prop()
  docId?: string;

  @Prop()
  docTitle?: string;

  @Prop()
  preview?: string;

  @Prop()
  score?: number;

  @Prop({
    enum: ['document', 'faq', 'note', 'datasheet', 'suggestion', 'website', 'manual_text', 'unknown'],
  })
  sourceType?: 'document' | 'faq' | 'note' | 'datasheet' | 'suggestion' | 'website' | 'manual_text' | 'unknown';

  @Prop({ type: Types.ObjectId })
  knowledgeBaseItemId?: Types.ObjectId;

  @Prop()
  sourceTitle?: string;

  @Prop()
  sourceUrl?: string;

  @Prop()
  usedAt?: Date;
}

export const MessageSourceSchema = SchemaFactory.createForClass(MessageSource);

@Schema({ _id: false })
export class MessageVoiceMeta {
  @Prop()
  isVoiceMessage?: boolean;

  @Prop()
  isDictationMessage?: boolean;

  @Prop()
  speechDurationSeconds?: number;

  @Prop()
  speechToTextCharacters?: number;

  @Prop()
  speechToTextWords?: number;

  @Prop()
  transcriptionProvider?: string;

  @Prop({ enum: ['pending', 'success', 'failed', 'not_required'] })
  transcriptionStatus?: 'pending' | 'success' | 'failed' | 'not_required';

  @Prop()
  dictationStartedAt?: Date;

  @Prop()
  dictationEndedAt?: Date;

  @Prop()
  dictationDurationSeconds?: number;

  @Prop()
  audioDurationSeconds?: number;

  @Prop()
  audioSizeBytes?: number;

  @Prop()
  audioMimeType?: string;

  /** Whisper/browser mic dictation sessions merged into composer before send (best-effort; default 1 on backend when dictation). */
  @Prop()
  dictationSessionCount?: number;
}

@Schema({ _id: false })
export class MessageCreditBreakdownRow {
  @Prop({ required: true })
  key!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  count!: number;

  @Prop({ required: true })
  creditsEach!: number;

  @Prop({ required: true })
  creditsUsed!: number;

  @Prop({ required: true })
  billable!: boolean;
}

export const MessageCreditBreakdownRowSchema = SchemaFactory.createForClass(MessageCreditBreakdownRow);

@Schema({ _id: false })
export class MessageAiMeta {
  @Prop()
  modelUsed?: string;

  @Prop()
  responseTimeMs?: number;

  @Prop()
  promptTokens?: number;

  @Prop()
  completionTokens?: number;

  @Prop()
  totalTokens?: number;

  @Prop()
  ragUsed?: boolean;

  @Prop()
  sourcesCount?: number;

  @Prop()
  fallbackUsed?: boolean;

  @Prop()
  errorCode?: string;

  /** Safe short message; no stack traces or secrets. */
  @Prop()
  errorMessage?: string;
}

@Schema({ _id: false })
export class MessageTopics {
  @Prop()
  primaryTopic?: string;

  @Prop({ type: [String], default: undefined })
  topicLabels?: string[];

  @Prop()
  topicConfidence?: number;

  /** Sub-topic id scoped to {@link primaryTopic} (validated server-side). */
  @Prop()
  primarySubTopic?: string;

  @Prop({ type: [String], default: undefined })
  subTopicLabels?: string[];
}

@Schema({ _id: false })
export class MessageSentiment {
  @Prop({ enum: ['positive', 'neutral', 'negative', 'mixed', 'unknown'] })
  label?: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';

  @Prop()
  score?: number;

  @Prop()
  reason?: string;
}

/** Denormalized from `assistant_message_feedback` analytics events (widget / preview). */
@Schema({ _id: false })
export class MessageFeedback {
  @Prop({ required: true, enum: ['up', 'down'] })
  rating: 'up' | 'down';

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop({ enum: ['widget', 'preview', 'unknown'] })
  source?: 'widget' | 'preview' | 'unknown';

  @Prop({ type: Types.ObjectId })
  eventId?: Types.ObjectId;
}

export const MessageFeedbackSchema = SchemaFactory.createForClass(MessageFeedback);

@Schema({ timestamps: false })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  /**
   * Chat identity for Message records (chatVisitorId).
   */
  @Prop({ required: true })
  chatVisitorId: string;

  /**
   * @deprecated Platform visitor id (legacy). Kept temporarily for visitor quota + visitor admin pages.
   * During migration we store platformVisitorId here while Conversation uses chatVisitorId.
   */
  @Prop()
  visitorId?: string;
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: string;
  /**
   * When true, this user message counts toward the trial runtime cap (30) for the platform visitor.
   */
  @Prop()
  trialRuntimeUserMessage?: boolean;
  /**
   * When true, this user message counts toward the showcase bot runtime cap (30) for the platform visitor.
   */
  @Prop()
  showcaseRuntimeUserMessage?: boolean;
  @Prop({ required: true })
  content: string;
  /** Original incoming text as seen by visitor/widget before normalization. */
  @Prop()
  originalText?: string;
  /** Detected language code/name for original text when available. */
  @Prop()
  originalLanguage?: string;
  /** English-normalized text used for transcript/admin surfaces. */
  @Prop()
  englishText?: string;
  /** Visitor-facing reply text (may be translated); assistant messages only. */
  @Prop()
  replyText?: string;
  /** Language used for visitor-facing assistant reply. */
  @Prop()
  replyLanguage?: string;
  /** Canonical English transcript line for analytics/history/admin viewers. */
  @Prop()
  englishTranscriptText?: string;
  /** RAG sources for assistant messages (chunk/doc references and previews). */
  @Prop({ type: [MessageSourceSchema], default: undefined })
  sources?: MessageSource[];
  /** How the user produced this message (composer dictate / voice); for analytics and support. */
  @Prop({ type: MessageSpeechInput, required: false })
  speechInput?: MessageSpeechInput;
  /** Files attached from the embedded widget (when allowFileUpload is on). */
  @Prop({
    type: [{ name: String, mimeType: String, url: String, size: Number }],
    required: false,
  })
  attachments?: MessageAttachment[];
  @Prop({ default: Date.now })
  createdAt: Date;
  /** Admin app route (e.g. path) when this message was sent in widget preview. */
  @Prop()
  previewSourcePage?: string;
  /** Browser origin (e.g. https://admin.assistrio.com) when the message was sent in preview. */
  @Prop()
  previewOrigin?: string;

  @Prop({
    enum: ['text', 'voice', 'dictation', 'attachment', 'quick_reply', 'suggested_question', 'welcome', 'unknown'],
  })
  inputType?: MessageInputType;

  /** True for the auto-sent opening assistant line when a conversation is created. */
  @Prop()
  isWelcomeMessage?: boolean;

  @Prop({
    enum: [
      'keyboard',
      'microphone',
      'microphone_transcription',
      'browser_speech_recognition',
      'file_upload',
      'quick_reply',
      'suggested_question',
      'api',
      'unknown',
    ],
  })
  inputMethod?: MessageInputMethod;

  @Prop()
  creditCost?: number;

  @Prop()
  creditReason?: string;

  @Prop()
  billingType?: string;

  @Prop()
  quotaPeriod?: string;

  @Prop()
  chargedAt?: Date;

  @Prop({ type: [MessageCreditBreakdownRowSchema], default: undefined })
  creditBreakdown?: MessageCreditBreakdownRow[];

  @Prop({ type: MessageVoiceMeta, required: false })
  voiceMeta?: MessageVoiceMeta;

  @Prop({ type: MessageAiMeta, required: false })
  aiMeta?: MessageAiMeta;

  @Prop({ type: MessageTopics, required: false })
  topics?: MessageTopics;

  @Prop({ type: MessageSentiment, required: false })
  sentiment?: MessageSentiment;

  /** Latest visitor thumbs feedback (assistant messages only). */
  @Prop({ type: MessageFeedbackSchema, required: false })
  feedback?: MessageFeedback;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ botId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ botId: 1, role: 1, createdAt: -1 });
MessageSchema.index({ botId: 1, inputType: 1, createdAt: -1 }, { sparse: true });
MessageSchema.index({ botId: 1, 'sources.sourceType': 1, createdAt: -1 }, { sparse: true });
