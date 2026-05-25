import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  DEFAULT_WORKSPACE_ONBOARDING_STATUS,
  DEFAULT_WORKSPACE_ONBOARDING_STEP,
  WORKSPACE_ONBOARDING_STATUSES,
  WORKSPACE_ONBOARDING_STEPS,
  type WorkspaceOnboardingStatus,
  type WorkspaceOnboardingStep,
} from './workspace-onboarding.constants';

@Schema({ timestamps: false, collection: 'workspaces' })
export class Workspace {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({
    enum: WORKSPACE_ONBOARDING_STATUSES,
    default: DEFAULT_WORKSPACE_ONBOARDING_STATUS,
  })
  onboardingStatus?: WorkspaceOnboardingStatus;

  @Prop({
    enum: WORKSPACE_ONBOARDING_STEPS,
    default: DEFAULT_WORKSPACE_ONBOARDING_STEP,
  })
  onboardingCurrentStep?: WorkspaceOnboardingStep;

  @Prop({ type: Types.ObjectId, required: false })
  onboardingDraftId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false })
  onboardingCreatedBotId?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  onboardingCompletedAt?: Date;

  /** Default per-person bot grants applied when a new agent is created in this workspace. */
  @Prop({
    type: {
      grantViewToWorkspacePeopleOnCreate: { type: Boolean, default: false },
      grantPreviewToWorkspacePeopleOnCreate: { type: Boolean, default: false },
    },
    default: () => ({
      grantViewToWorkspacePeopleOnCreate: false,
      grantPreviewToWorkspacePeopleOnCreate: false,
    }),
  })
  defaultBotAccessPolicy?: {
    grantViewToWorkspacePeopleOnCreate: boolean;
    grantPreviewToWorkspacePeopleOnCreate: boolean;
  };
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
WorkspaceSchema.index({ createdAt: -1 });
