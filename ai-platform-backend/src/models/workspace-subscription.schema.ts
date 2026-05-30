import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BILLING_PROVIDERS, type BillingProvider } from '../billing/billing-provider.types';
import { PLAN_KEYS, type PlanKey } from '../entitlements/plan-catalog';

export const WORKSPACE_SUBSCRIPTION_STATUSES = [
  'free',
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
] as const;

export type WorkspaceSubscriptionStatus = (typeof WORKSPACE_SUBSCRIPTION_STATUSES)[number];

@Schema({ timestamps: true, collection: 'workspace_subscriptions' })
export class WorkspaceSubscription {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, unique: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, enum: PLAN_KEYS, default: 'free' })
  planKey: PlanKey;

  @Prop({ required: true, enum: WORKSPACE_SUBSCRIPTION_STATUSES, default: 'free' })
  status: WorkspaceSubscriptionStatus;

  @Prop({ type: Date, required: true })
  currentPeriodStart: Date;

  @Prop({ type: Date, required: true })
  currentPeriodEnd: Date;

  @Prop({ type: String, enum: BILLING_PROVIDERS, default: null })
  provider: BillingProvider | null;

  @Prop({ type: String, default: null, index: true })
  providerCustomerId: string | null;

  @Prop({ type: String, default: null, index: true })
  providerSubscriptionId: string | null;

  @Prop({ type: String, default: null })
  providerVariantId: string | null;

  @Prop({ type: Boolean, default: false })
  cancelAtPeriodEnd: boolean;

  @Prop({
    type: {
      failedAt: { type: Date, required: true },
      invoiceId: { type: String, default: null },
      invoiceUrl: { type: String, default: null },
      amount: { type: Number, default: null },
      currency: { type: String, default: null },
      cardBrand: { type: String, default: null },
      cardLastFour: { type: String, default: null },
      notifiedWebhookEventId: { type: String, default: null },
      notifiedInvoiceId: { type: String, default: null },
    },
    default: null,
    _id: false,
  })
  paymentFailure: {
    failedAt: Date;
    invoiceId?: string | null;
    invoiceUrl?: string | null;
    amount?: number | null;
    currency?: string | null;
    cardBrand?: string | null;
    cardLastFour?: string | null;
    notifiedWebhookEventId?: string | null;
    notifiedInvoiceId?: string | null;
  } | null;

  @Prop({
    type: {
      brand: { type: String, default: null },
      last4: { type: String, default: null },
      label: { type: String, default: null },
    },
    default: null,
    _id: false,
  })
  paymentMethod: {
    brand?: string | null;
    last4?: string | null;
    label?: string | null;
  } | null;

  @Prop({ type: String, default: null })
  lastPaymentRecoveryNotifiedWebhookEventId: string | null;

  @Prop({ type: Date, default: null })
  subscriptionCancelEmailSentAt: Date | null;

  @Prop({ type: Date, default: null })
  subscriptionRestoredEmailSentAt: Date | null;

  @Prop({ type: String, default: null })
  lastPaymentReceiptEmailWebhookEventId: string | null;
}

export type WorkspaceSubscriptionDocument = HydratedDocument<WorkspaceSubscription>;
export const WorkspaceSubscriptionSchema = SchemaFactory.createForClass(WorkspaceSubscription);
