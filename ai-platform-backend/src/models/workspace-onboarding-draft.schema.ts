import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  WORKSPACE_ONBOARDING_STEPS,
  type WorkspaceOnboardingStep,
} from './workspace-onboarding.constants';
import {
  WorkspaceOnboardingDraftFaq,
  WorkspaceOnboardingDraftQa,
  WorkspaceOnboardingDraftSnippet,
} from './workspace-onboarding-knowledge.schema';

@Schema({ _id: false })
export class WorkspaceOnboardingDraftProfile {
  @Prop({ trim: true, default: '' })
  name?: string;

  @Prop({ trim: true, default: '' })
  shortDescription?: string;

  @Prop({ trim: true, default: '' })
  description?: string;

  @Prop({ type: [String], default: [] })
  categories?: string[];

  @Prop({ trim: true, default: '' })
  avatarSource?: string;

  @Prop({ trim: true, default: '' })
  imageUrl?: string;

  @Prop({ trim: true, default: '' })
  avatarEmoji?: string;

  @Prop({ trim: true, default: '' })
  avatarStorageKey?: string;

  /** Widget brand color (#RRGGBB) — applied to bot chatUI on go-live. */
  @Prop({ trim: true, default: '' })
  brandColor?: string;
}

@Schema({ _id: false })
export class WorkspaceOnboardingDraftInstructions {
  @Prop({ trim: true, default: '' })
  description?: string;

  @Prop({ trim: true, default: '' })
  systemPrompt?: string;

  @Prop({ default: 'friendly' })
  tone?: string;

  @Prop({ default: 'default' })
  behaviorPreset?: string;

  @Prop({ enum: ['short', 'medium', 'long'], default: 'medium' })
  responseLength?: string;

  @Prop({ default: 160 })
  maxTokens?: number;
}

@Schema({ _id: false })
export class WorkspaceOnboardingDraftKnowledge {
  @Prop({ trim: true, default: '' })
  knowledgeDescription?: string;

  /** @deprecated Legacy FAQ rows — use `qas`. */
  @Prop({ type: [WorkspaceOnboardingDraftFaq], default: [] })
  faqs?: WorkspaceOnboardingDraftFaq[];

  @Prop({ type: [WorkspaceOnboardingDraftSnippet], default: [] })
  snippets?: WorkspaceOnboardingDraftSnippet[];

  @Prop({ type: [WorkspaceOnboardingDraftQa], default: [] })
  qas?: WorkspaceOnboardingDraftQa[];
}

@Schema({ _id: false })
export class WorkspaceOnboardingDraftAllowedOrigin {
  @Prop({ required: true, trim: true })
  origin: string;

  @Prop({ trim: true })
  label?: string;

  @Prop({ default: true })
  isActive?: boolean;
}

@Schema({ _id: false })
export class WorkspaceOnboardingDraftGoLive {
  @Prop({ type: [WorkspaceOnboardingDraftAllowedOrigin], default: [] })
  allowedOrigins?: WorkspaceOnboardingDraftAllowedOrigin[];
}

const WorkspaceOnboardingDraftProfileSchema = SchemaFactory.createForClass(WorkspaceOnboardingDraftProfile);
const WorkspaceOnboardingDraftInstructionsSchema = SchemaFactory.createForClass(
  WorkspaceOnboardingDraftInstructions,
);
const WorkspaceOnboardingDraftKnowledgeSchema = SchemaFactory.createForClass(WorkspaceOnboardingDraftKnowledge);
const WorkspaceOnboardingDraftGoLiveSchema = SchemaFactory.createForClass(WorkspaceOnboardingDraftGoLive);

@Schema({ timestamps: true, collection: 'workspace_onboarding_drafts' })
export class WorkspaceOnboardingDraft {
  @Prop({ type: Types.ObjectId, required: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: WorkspaceOnboardingDraftProfileSchema, default: () => ({}) })
  profile?: WorkspaceOnboardingDraftProfile;

  @Prop({ type: WorkspaceOnboardingDraftInstructionsSchema, default: () => ({}) })
  instructions?: WorkspaceOnboardingDraftInstructions;

  @Prop({ type: WorkspaceOnboardingDraftKnowledgeSchema, default: () => ({}) })
  knowledge?: WorkspaceOnboardingDraftKnowledge;

  @Prop({ type: WorkspaceOnboardingDraftGoLiveSchema, default: () => ({}) })
  goLive?: WorkspaceOnboardingDraftGoLive;

  @Prop({ type: [String], enum: WORKSPACE_ONBOARDING_STEPS, default: [] })
  stepsCompleted?: WorkspaceOnboardingStep[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const WorkspaceOnboardingDraftSchema = SchemaFactory.createForClass(WorkspaceOnboardingDraft);
WorkspaceOnboardingDraftSchema.index({ workspaceId: 1 }, { unique: true });
