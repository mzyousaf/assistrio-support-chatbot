import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const ONBOARDING_KNOWLEDGE_STAGING_SOURCE_TYPES = ['document', 'datasheet'] as const;
export type OnboardingKnowledgeStagingSourceType = (typeof ONBOARDING_KNOWLEDGE_STAGING_SOURCE_TYPES)[number];

export const ONBOARDING_KNOWLEDGE_STAGING_STATUSES = [
  'uploaded',
  'transfer_pending',
  'transferred',
  'failed',
] as const;
export type OnboardingKnowledgeStagingStatus = (typeof ONBOARDING_KNOWLEDGE_STAGING_STATUSES)[number];

@Schema({ _id: true, timestamps: true, collection: 'workspace_onboarding_knowledge_staging' })
export class WorkspaceOnboardingKnowledgeStaging {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  onboardingDraftId!: Types.ObjectId;

  @Prop({ required: true, enum: ONBOARDING_KNOWLEDGE_STAGING_SOURCE_TYPES })
  sourceType!: OnboardingKnowledgeStagingSourceType;

  @Prop({ required: true, trim: true })
  originalName!: string;

  @Prop({ default: '', trim: true })
  mimeType!: string;

  @Prop({ required: true, min: 0 })
  sizeBytes!: number;

  @Prop({ required: true, trim: true })
  storageKey!: string;

  @Prop({ default: '', trim: true })
  s3Bucket!: string;

  @Prop({ required: true, enum: ONBOARDING_KNOWLEDGE_STAGING_STATUSES, default: 'uploaded' })
  status!: OnboardingKnowledgeStagingStatus;

  @Prop({ default: '', trim: true })
  errorMessage!: string;

  @Prop({ type: Types.ObjectId })
  transferredBotId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  createdKnowledgeItemId?: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;
}

export type WorkspaceOnboardingKnowledgeStagingDocument = HydratedDocument<WorkspaceOnboardingKnowledgeStaging>;

export const WorkspaceOnboardingKnowledgeStagingSchema = SchemaFactory.createForClass(
  WorkspaceOnboardingKnowledgeStaging,
);

WorkspaceOnboardingKnowledgeStagingSchema.index({ onboardingDraftId: 1, sourceType: 1, status: 1 });
