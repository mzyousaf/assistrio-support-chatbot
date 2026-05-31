import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BILLING_PROVIDERS, type BillingProvider } from '../billing/billing-provider.types';
import { AUTO_TOPUP_CREDIT_SOURCE } from '../billing/billing-auto-topup.constants';

export const WORKSPACE_CREDIT_TOP_UP_SOURCES = ['manual', AUTO_TOPUP_CREDIT_SOURCE] as const;
export type WorkspaceCreditTopUpSource = (typeof WORKSPACE_CREDIT_TOP_UP_SOURCES)[number];

@Schema({ timestamps: true, collection: 'workspace_credit_top_ups' })
export class WorkspaceCreditTopUp {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  creditsPurchased: number;

  @Prop({ required: true, min: 0 })
  creditsRemaining: number;

  @Prop({ required: true, enum: BILLING_PROVIDERS })
  provider: BillingProvider;

  @Prop({ required: true, unique: true, index: true })
  providerOrderId: string;

  @Prop({ required: true, enum: WORKSPACE_CREDIT_TOP_UP_SOURCES, default: 'manual' })
  source: WorkspaceCreditTopUpSource;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  /** Set by period-end reconcile when the top-up pool is no longer usable (credits remain stored). */
  @Prop({ type: Date, default: null })
  expiredAt: Date | null;
}

export type WorkspaceCreditTopUpDocument = HydratedDocument<WorkspaceCreditTopUp>;
export const WorkspaceCreditTopUpSchema = SchemaFactory.createForClass(WorkspaceCreditTopUp);
