import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

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
  @Prop({ required: true })
  visitorId: string;
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: string;
  @Prop({ required: true })
  content: string;
  /** RAG sources for assistant messages (chunk/doc references and previews). */
  @Prop({ type: [{ chunkId: String, docId: String, docTitle: String, preview: String, score: Number }], default: undefined })
  sources?: MessageSource[];
  @Prop({ default: Date.now })
  createdAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
