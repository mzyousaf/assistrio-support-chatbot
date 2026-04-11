import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Stable trial onboarding workspace identity: one document per normalized email.
 * Sessions authorize access; this row owns the single {@link TrialOnboardingDraft} per email.
 */
@Schema({ collection: 'trial_email_workspaces', timestamps: true })
export class TrialEmailWorkspace {
  @Prop({ required: true, unique: true, index: true, trim: true })
  emailNormalized: string;

  /** Last-seen platform visitor (may change across devices). */
  @Prop({ required: true, index: true, trim: true })
  platformVisitorId: string;
}

export type TrialEmailWorkspaceDocument = HydratedDocument<TrialEmailWorkspace>;

export const TrialEmailWorkspaceSchema = SchemaFactory.createForClass(TrialEmailWorkspace);
