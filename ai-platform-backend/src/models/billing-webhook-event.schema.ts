import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BILLING_PROVIDERS, type BillingProvider } from '../billing/billing-provider.types';

export const BILLING_WEBHOOK_EVENT_STATUSES = [
  'received',
  'processed',
  'failed',
  'ignored',
] as const;

export type BillingWebhookEventStatus = (typeof BILLING_WEBHOOK_EVENT_STATUSES)[number];

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'billing_webhook_events' })
export class BillingWebhookEventRecord {
  @Prop({ required: true, enum: BILLING_PROVIDERS, index: true })
  provider: BillingProvider;

  @Prop({ required: true, index: true })
  providerEventId: string;

  @Prop({ required: true })
  eventName: string;

  @Prop({ required: true })
  payloadHash: string;

  @Prop({ type: Object, required: true })
  rawPayload: Record<string, unknown>;

  @Prop({ required: true, enum: BILLING_WEBHOOK_EVENT_STATUSES, default: 'received' })
  status: BillingWebhookEventStatus;

  @Prop({ type: String, default: null })
  processingError: string | null;

  @Prop({ type: Date, default: () => new Date() })
  receivedAt: Date;

  @Prop({ type: Date, default: null })
  processedAt: Date | null;

  @Prop({ type: Date, default: null })
  failedAt: Date | null;

  @Prop({ type: Number, default: 0 })
  retryCount: number;

  @Prop({ type: Date, default: null })
  lastRetryAt: Date | null;

  @Prop({ type: Date, default: null })
  nextRetryAt: Date | null;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  workspaceId: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  alertedAt: Date | null;
}

export type BillingWebhookEventDocument = HydratedDocument<BillingWebhookEventRecord>;
export const BillingWebhookEventSchema = SchemaFactory.createForClass(BillingWebhookEventRecord);

BillingWebhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
BillingWebhookEventSchema.index({ status: 1, failedAt: -1 });
