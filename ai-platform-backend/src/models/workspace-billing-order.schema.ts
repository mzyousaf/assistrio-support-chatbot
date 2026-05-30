import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BILLING_PROVIDERS, type BillingProvider } from '../billing/billing-provider.types';

export const WORKSPACE_BILLING_CHECKOUT_TYPES = ['plan', 'addon', 'top_up'] as const;
export type WorkspaceBillingCheckoutType = (typeof WORKSPACE_BILLING_CHECKOUT_TYPES)[number];

@Schema({ timestamps: true, collection: 'workspace_billing_orders' })
export class WorkspaceBillingOrder {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, enum: BILLING_PROVIDERS })
  provider: BillingProvider;

  @Prop({ required: true, unique: true, index: true })
  providerOrderId: string;

  @Prop({ required: true, enum: WORKSPACE_BILLING_CHECKOUT_TYPES })
  checkoutType: WorkspaceBillingCheckoutType;

  @Prop({ type: String, default: null })
  planKey: string | null;

  @Prop({ type: String, default: null })
  addonKey: string | null;

  @Prop({ type: String, default: null })
  topUpKey: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Bot', default: null })
  targetBotId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  providerSubscriptionId: string | null;

  @Prop({ required: true, min: 0 })
  amountCents: number;

  @Prop({ required: true, default: 'USD' })
  currency: string;

  @Prop({ required: true, default: 'paid' })
  status: string;

  @Prop({ type: String, default: null })
  invoiceUrl: string | null;

  @Prop({ type: String, default: null })
  receiptUrl: string | null;

  @Prop({ type: Date, required: true })
  orderCreatedAt: Date;
}

export type WorkspaceBillingOrderDocument = HydratedDocument<WorkspaceBillingOrder>;
export const WorkspaceBillingOrderSchema = SchemaFactory.createForClass(WorkspaceBillingOrder);
