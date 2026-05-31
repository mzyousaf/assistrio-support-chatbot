import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BILLING_PROVIDERS, type BillingProvider } from '../billing/billing-provider.types';

export const WORKSPACE_AUTO_TOP_UP_STATUSES = [
  'pending',
  'active',
  'past_due',
  'scheduled_disable',
  'canceled',
] as const;

export type WorkspaceAutoTopUpStatus = (typeof WORKSPACE_AUTO_TOP_UP_STATUSES)[number];

@Schema({ timestamps: true, collection: 'workspace_auto_top_up_subscriptions' })
export class WorkspaceAutoTopUpSubscription {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, unique: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, enum: WORKSPACE_AUTO_TOP_UP_STATUSES, default: 'pending' })
  status: WorkspaceAutoTopUpStatus;

  @Prop({ required: true, enum: BILLING_PROVIDERS })
  provider: BillingProvider;

  @Prop({ type: String, default: null, index: true })
  providerSubscriptionId: string | null;

  @Prop({ type: String, default: null })
  providerSubscriptionItemId: string | null;

  @Prop({ type: String, default: null })
  providerCustomerId: string | null;

  @Prop({ type: String, default: null })
  providerVariantId: string | null;

  @Prop({ type: Boolean, default: false })
  cancelAtPeriodEnd: boolean;

  @Prop({ type: Date, default: null })
  currentPeriodStart: Date | null;

  @Prop({ type: Date, default: null })
  currentPeriodEnd: Date | null;

  @Prop({ type: Number, default: 0, min: 0 })
  packsThisBillingPeriod: number;

  @Prop({ type: Date, default: null })
  billingPeriodStart: Date | null;

  @Prop({ type: Date, default: null })
  billingPeriodEnd: Date | null;

  @Prop({ type: Date, default: null })
  activatedAt: Date | null;

  @Prop({ type: Date, default: null })
  disabledAt: Date | null;
}

export type WorkspaceAutoTopUpSubscriptionDocument = HydratedDocument<WorkspaceAutoTopUpSubscription>;
export const WorkspaceAutoTopUpSubscriptionSchema = SchemaFactory.createForClass(
  WorkspaceAutoTopUpSubscription,
);
