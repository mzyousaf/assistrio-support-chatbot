import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const ONBOARDING_KB_TRANSFER_JOB_TYPE = 'onboarding_kb_transfer' as const;

export type OnboardingKbTransferJobStatus = 'queued' | 'processing' | 'done' | 'failed';

/**
 * Durable post-go-live transfer of onboarding draft knowledge (snippets, Q&A, staged files)
 * into the published bot KB. Processed by {@link WorkspaceOnboardingKbTransferJobService}.
 */
@Schema({ timestamps: true, collection: 'onboarding_kb_transfer_jobs' })
export class OnboardingKbTransferJob {
  @Prop({ type: String, required: true, enum: [ONBOARDING_KB_TRANSFER_JOB_TYPE], default: ONBOARDING_KB_TRANSFER_JOB_TYPE })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkspaceOnboardingDraft', required: true })
  onboardingDraftId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['queued', 'processing', 'done', 'failed'],
  })
  status: OnboardingKbTransferJobStatus;

  @Prop()
  error?: string;

  @Prop({ default: 0, min: 0 })
  retryCount: number;

  @Prop({ default: 0, min: 0 })
  stuckRecoveryCycles: number;

  @Prop()
  queuedAt?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OnboardingKbTransferJobSchema = SchemaFactory.createForClass(OnboardingKbTransferJob);

export const ONBOARDING_KB_TRANSFER_JOB_MONGO_COLLECTION =
  OnboardingKbTransferJobSchema.get('collection') || 'onboarding_kb_transfer_jobs';

OnboardingKbTransferJobSchema.index({ workspaceId: 1 });
OnboardingKbTransferJobSchema.index({ botId: 1 });
OnboardingKbTransferJobSchema.index({ status: 1, queuedAt: 1, createdAt: 1 });
OnboardingKbTransferJobSchema.index({ workspaceId: 1, botId: 1, createdAt: -1 });
/** At most one live transfer job per workspace (go-live idempotency). */
OnboardingKbTransferJobSchema.index(
  { workspaceId: 1 },
  {
    unique: true,
    name: 'workspaceId_1_live_onboarding_kb_transfer_unique',
    partialFilterExpression: {
      status: { $in: ['queued', 'processing'] },
    },
  },
);
