import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Mongo collection name for usage / credit ledger rows (future writes). */
export const USAGE_LEDGER_MONGO_COLLECTION = 'usage_ledgers';

export type UsageLedgerUsageType =
  | 'text_message'
  | 'voice_message'
  | 'dictation_message'
  | 'attachment_message'
  | 'suggested_question_message'
  | 'quick_reply_message'
  | 'unknown_message'
  | 'assistant_reply'
  | 'stt_seconds'
  | 'unknown';

/**
 * Append-only style ledger for future credit/quota accounting.
 * No runtime writes in Prompt 1 — schema only.
 */
@Schema({ timestamps: false, collection: USAGE_LEDGER_MONGO_COLLECTION })
export class UsageLedger {
  @Prop({ type: Types.ObjectId, ref: 'Workspace' })
  workspaceId?: Types.ObjectId;

  /** Workspace member / billing user when distinct from visitor. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  customerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation' })
  conversationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  messageId?: Types.ObjectId;

  @Prop()
  visitorId?: string;

  @Prop({
    required: true,
    enum: [
      'text_message',
      'voice_message',
      'dictation_message',
      'attachment_message',
      'suggested_question_message',
      'quick_reply_message',
      'unknown_message',
      'assistant_reply',
      'stt_seconds',
      'unknown',
    ],
    default: 'unknown',
  })
  usageType: UsageLedgerUsageType;

  @Prop({ default: 0 })
  creditsUsed: number;

  @Prop()
  creditRule?: string;

  @Prop()
  planAtTime?: string;

  @Prop()
  billingPeriodStart?: Date;

  @Prop()
  billingPeriodEnd?: Date;

  @Prop({ default: Date.now })
  chargedAt: Date;

  @Prop({ type: Object, default: undefined })
  metadata?: Record<string, unknown>;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export type UsageLedgerDocument = HydratedDocument<UsageLedger>;
export const UsageLedgerSchema = SchemaFactory.createForClass(UsageLedger);

UsageLedgerSchema.index({ workspaceId: 1, chargedAt: -1 }, { sparse: true });
UsageLedgerSchema.index({ customerId: 1, chargedAt: -1 }, { sparse: true });
UsageLedgerSchema.index({ botId: 1, chargedAt: -1 });
UsageLedgerSchema.index({ conversationId: 1, chargedAt: -1 }, { sparse: true });
UsageLedgerSchema.index({ messageId: 1 }, { sparse: true });
UsageLedgerSchema.index({ usageType: 1, chargedAt: -1 });
UsageLedgerSchema.index({ billingPeriodStart: 1, billingPeriodEnd: 1 }, { sparse: true });
