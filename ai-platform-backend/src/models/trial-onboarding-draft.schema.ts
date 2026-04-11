import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Mirrors assistrio-landing-site `TrialProfileQuickLink`. */
@Schema({ _id: false })
export class TrialOnboardingQuickLink {
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, trim: true })
  url: string;
}

export const TrialOnboardingQuickLinkSchema = SchemaFactory.createForClass(TrialOnboardingQuickLink);

/** Metadata for S3-backed assets (avatar / knowledge files). */
@Schema({ _id: false })
export class TrialOnboardingAssetMeta {
  @Prop({ required: true, enum: ['avatar', 'knowledge_document'] })
  kind: 'avatar' | 'knowledge_document';

  @Prop({ required: true, trim: true })
  assetKey: string;

  @Prop({ required: true, trim: true })
  originalFilename: string;

  @Prop({ required: true, trim: true })
  mimeType: string;

  @Prop({ required: true, min: 0 })
  sizeBytes: number;

  @Prop({ required: true, type: Date })
  uploadedAt: Date;

  /** Public or time-limited URL when available. */
  @Prop({ trim: true })
  url?: string;
}

export const TrialOnboardingAssetMetaSchema = SchemaFactory.createForClass(TrialOnboardingAssetMeta);

/** Avatar uploaded via Assistrio (S3). `updatedAt` drives “latest source wins”. */
@Schema({ _id: false })
export class TrialAvatarByUpload {
  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ trim: true })
  assetKey?: string;

  @Prop({ trim: true })
  originalFilename?: string;

  @Prop({ trim: true })
  mimeType?: string;

  @Prop({ min: 0 })
  sizeBytes?: number;

  @Prop({ type: Date, required: true })
  updatedAt: Date;
}

export const TrialAvatarByUploadSchema = SchemaFactory.createForClass(TrialAvatarByUpload);

/** Avatar URL explicitly entered by the user (never an upload CDN URL in this field). */
@Schema({ _id: false })
export class TrialAvatarByUserURL {
  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ type: Date, required: true })
  updatedAt: Date;
}

export const TrialAvatarByUserURLSchema = SchemaFactory.createForClass(TrialAvatarByUserURL);

/**
 * Server-side onboarding draft for the public trial dashboard.
 * Owned by {@link TrialEmailWorkspace} (stable per normalized email). Session only authorizes access.
 */
@Schema({ collection: 'trial_onboarding_drafts', timestamps: true })
export class TrialOnboardingDraft {
  /**
   * Stable workspace owner — one draft per email. Sessions map to this via email after auth.
   */
  @Prop({ type: Types.ObjectId, ref: 'TrialEmailWorkspace', unique: true, sparse: true, index: true })
  trialWorkspaceId?: Types.ObjectId;

  /**
   * Legacy session key (pre–email-workspace). Optional after migration; not used for new drafts.
   */
  @Prop({ trim: true, sparse: true, index: true })
  sessionTokenHash?: string;

  /** Denormalized from session for support / analytics (authorization uses session only). */
  @Prop({ required: true, index: true })
  platformVisitorId: string;

  @Prop({ required: true, index: true })
  emailNormalized: string;

  @Prop({ default: 1, min: 1 })
  schemaVersion: number;

  // --- Profile / branding (aligned with landing `TrialWorkspaceProfile`) ---

  @Prop({ trim: true })
  agentName?: string;

  @Prop({ type: [String], default: [] })
  categories: string[];

  /** @deprecated Legacy single field; resolution uses {@link avatarByUpload} / {@link avatarByUserURL}. */
  @Prop({ trim: true })
  avatarUrl?: string;

  @Prop({ type: TrialAvatarByUploadSchema })
  avatarByUpload?: TrialAvatarByUpload;

  @Prop({ type: TrialAvatarByUserURLSchema })
  avatarByUserURL?: TrialAvatarByUserURL;

  @Prop({ trim: true })
  brandColor?: string;

  @Prop({ type: [TrialOnboardingQuickLinkSchema], default: [] })
  quickLinks: TrialOnboardingQuickLink[];

  // --- Behavior / describe-agent ---

  @Prop({ type: Object })
  behavior?: Record<string, unknown>;

  /** Optional legacy single-field description; prefer `behavior`. */
  @Prop({ trim: true })
  describeAgent?: string;

  // --- Knowledge base draft ---

  @Prop({ type: Object })
  knowledge?: Record<string, unknown>;

  // --- Website / go-live ---

  @Prop({ trim: true })
  allowedWebsite?: string;

  @Prop({ trim: true })
  allowedDomainsExtra?: string;

  @Prop({ default: false })
  knowledgeContinued?: boolean;

  // --- Step progress (aligned with landing setup rail) ---

  @Prop({ trim: true })
  currentStepId?: string;

  @Prop({ type: [Boolean], default: [false, false, false, false] })
  setupStepOnceCompleted: boolean[];

  @Prop({ type: Number, default: 0, min: 0, max: 3 })
  setupExplicitMaxStepIndex: number;

  @Prop({ trim: true })
  lastUpdatedStepId?: string;

  @Prop({ default: false })
  onboardingCompleted?: boolean;

  @Prop({ type: [TrialOnboardingAssetMetaSchema], default: [] })
  uploadedAssets: TrialOnboardingAssetMeta[];

  /** Optional link to session document for future joins / TTL alignment. */
  @Prop({ type: Types.ObjectId, ref: 'TrialDashboardSession', index: true })
  trialDashboardSessionId?: Types.ObjectId;

  /** Populated after successful “Create AI Agent” — unlocks playground in the trial dashboard. */
  @Prop({ type: Object })
  trialAgent?: {
    botId: string;
    slug: string;
    accessKey: string;
    name: string;
    imageUrl?: string;
    allowedDomain: string;
    createdAt: Date;
  };
}

export type TrialOnboardingDraftDocument = HydratedDocument<TrialOnboardingDraft>;

export const TrialOnboardingDraftSchema = SchemaFactory.createForClass(TrialOnboardingDraft);
