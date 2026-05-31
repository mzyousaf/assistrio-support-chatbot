import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BILLING_PROVIDERS, type BillingProvider } from '../billing/billing-provider.types';
import { BILLING_ADDON_CHECKOUT_KEYS, type BillingAddonCheckoutKey } from '../billing/billing-provider.types';
import { BILLING_INTERVALS, type BillingInterval } from '../billing/billing-interval.types';

export const WORKSPACE_ADDON_STATUSES = ['active', 'past_due', 'cancelled', 'expired'] as const;
export type WorkspaceAddonStatus = (typeof WORKSPACE_ADDON_STATUSES)[number];

@Schema({ timestamps: true, collection: 'workspace_addons' })
export class WorkspaceAddon {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, enum: BILLING_ADDON_CHECKOUT_KEYS })
  addonKey: BillingAddonCheckoutKey;

  @Prop({ required: true, enum: BILLING_INTERVALS, default: 'monthly' })
  billingInterval: BillingInterval;

  @Prop({ type: Types.ObjectId, ref: 'Bot', default: null, index: true })
  targetBotId: Types.ObjectId | null;

  @Prop({ required: true, enum: WORKSPACE_ADDON_STATUSES, default: 'active' })
  status: WorkspaceAddonStatus;

  @Prop({ required: true, enum: BILLING_PROVIDERS })
  provider: BillingProvider;

  @Prop({ type: String, default: null })
  providerSubscriptionId: string | null;

  @Prop({ type: String, default: null })
  providerVariantId: string | null;

  @Prop({ type: String, default: null })
  providerCustomerId: string | null;

  @Prop({ type: String, default: null, index: true })
  providerOrderId: string | null;

  @Prop({ type: Date, default: null })
  currentPeriodStart: Date | null;

  @Prop({ type: Date, default: null })
  currentPeriodEnd: Date | null;

  @Prop({ type: Boolean, default: false })
  cancelAtPeriodEnd: boolean;

  @Prop({
    type: {
      fromBillingInterval: { type: String, enum: BILLING_INTERVALS, required: true },
      toBillingInterval: { type: String, enum: BILLING_INTERVALS, required: true },
      effectiveAt: { type: Date, required: true },
      status: { type: String, enum: ['scheduled', 'applied', 'canceled'], required: true },
      appliedAt: { type: Date, default: null },
    },
    default: null,
    _id: false,
  })
  scheduledIntervalChange: {
    fromBillingInterval: BillingInterval;
    toBillingInterval: BillingInterval;
    effectiveAt: Date;
    status: 'scheduled' | 'applied' | 'canceled';
    appliedAt?: Date | null;
  } | null;

  @Prop({ type: Date, default: null })
  expiredAt: Date | null;
}

export type WorkspaceAddonDocument = HydratedDocument<WorkspaceAddon>;
export const WorkspaceAddonSchema = SchemaFactory.createForClass(WorkspaceAddon);

/** One provider subscription maps to one add-on instance (supports multiple extra_bot rows). */
WorkspaceAddonSchema.index(
  { provider: 1, providerSubscriptionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerSubscriptionId: { $exists: true, $type: 'string' },
    },
  },
);

/** At most one active remove_branding add-on per workspace (extra_bot is not limited here). */
WorkspaceAddonSchema.index(
  { workspaceId: 1, addonKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      addonKey: 'remove_branding',
      status: { $in: ['active', 'past_due'] },
    },
  },
);
