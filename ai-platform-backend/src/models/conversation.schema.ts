import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Stored lead field values captured during the conversation.
 * Keys match bot leadCapture.fields[].key; values are strings from user input.
 */
export type CapturedLeadData = Record<string, string>;

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
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  /**
   * Chat identity for Conversation history + message association.
   * This must come from the embedded widget's chat visitor (chatVisitorId).
   */
  @Prop({ required: true })
  chatVisitorId: string;

  /**
   * @deprecated Platform visitor id (legacy). Kept temporarily so existing visitor/quota logic can keep working.
   * During migration we store platformVisitorId here while Conversation uses chatVisitorId.
   */
  @Prop()
  visitorId?: string;
  @Prop({ default: Date.now })
  createdAt: Date;
  /** Lead capture: field key -> value collected from this conversation. */
  @Prop({ type: Object, default: undefined })
  capturedLeadData?: CapturedLeadData;
  /** Lead capture repetition control; optional, backward-compatible. */
  @Prop({ type: Object, default: undefined })
  leadCaptureMeta?: LeadCaptureMeta;
  /** Optional short summary for long conversations (future summarization pipeline). */
  @Prop({ default: undefined })
  summary?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
