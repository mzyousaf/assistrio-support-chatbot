import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
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
}

export type WorkspaceSubscriptionDocument = HydratedDocument<WorkspaceSubscription>;
export const WorkspaceSubscriptionSchema = SchemaFactory.createForClass(WorkspaceSubscription);
