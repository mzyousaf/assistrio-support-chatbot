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
}

/** Stored source reference for RAG-backed assistant messages */
export interface MessageSource {
  chunkId?: string;
  docId: string;
  docTitle: string;
  preview?: string;
  score?: number;
}

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
  /** RAG sources for assistant messages (chunk/doc references and previews). */
  @Prop({ type: [{ chunkId: String, docId: String, docTitle: String, preview: String, score: Number }], default: undefined })
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
}

export const MessageSchema = SchemaFactory.createForClass(Message);
