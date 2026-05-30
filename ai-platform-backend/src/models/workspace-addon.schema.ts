import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BILLING_PROVIDERS, type BillingProvider } from '../billing/billing-provider.types';
import { BILLING_ADDON_CHECKOUT_KEYS, type BillingAddonCheckoutKey } from '../billing/billing-provider.types';

export const WORKSPACE_ADDON_STATUSES = ['active', 'cancelled', 'expired'] as const;
export type WorkspaceAddonStatus = (typeof WORKSPACE_ADDON_STATUSES)[number];

@Schema({ timestamps: true, collection: 'workspace_addons' })
export class WorkspaceAddon {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, enum: BILLING_ADDON_CHECKOUT_KEYS })
  addonKey: BillingAddonCheckoutKey;

  @Prop({ type: Types.ObjectId, ref: 'Bot', default: null, index: true })
  targetBotId: Types.ObjectId | null;

  @Prop({ required: true, enum: WORKSPACE_ADDON_STATUSES, default: 'active' })
  status: WorkspaceAddonStatus;

  @Prop({ required: true, enum: BILLING_PROVIDERS })
  provider: BillingProvider;

  @Prop({ type: String, default: null, index: true })
  providerSubscriptionId: string | null;

  @Prop({ type: String, default: null, index: true })
  providerOrderId: string | null;

  @Prop({ type: Date, default: null })
  currentPeriodStart: Date | null;

  @Prop({ type: Date, default: null })
  currentPeriodEnd: Date | null;

  @Prop({ type: Boolean, default: false })
  cancelAtPeriodEnd: boolean;
}

export type WorkspaceAddonDocument = HydratedDocument<WorkspaceAddon>;
export const WorkspaceAddonSchema = SchemaFactory.createForClass(WorkspaceAddon);

WorkspaceAddonSchema.index(
  { workspaceId: 1, addonKey: 1, targetBotId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
