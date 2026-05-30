import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BILLING_PROVIDERS, type BillingProvider } from '../billing/billing-provider.types';

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

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export type WorkspaceCreditTopUpDocument = HydratedDocument<WorkspaceCreditTopUp>;
export const WorkspaceCreditTopUpSchema = SchemaFactory.createForClass(WorkspaceCreditTopUp);
