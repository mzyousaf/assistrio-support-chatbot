import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Magic-link tokens for landing “request access” flow.
 * Stores **SHA-256 hex hash** of the opaque token; raw token is only sent by email (Prompt 2) and verified later (Prompt 4).
 */
@Schema({ collection: 'trial_access_tokens', timestamps: true })
export class TrialAccessToken {
  @Prop({ required: true, index: true })
  platformVisitorId: string;

  /** SHA-256 hex digest of the raw opaque token (never store raw token). */
  @Prop({ required: true, unique: true, index: true })
  tokenHash: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  /** Set when the link is consumed (Prompt 4) or superseded — optional until then. */
  @Prop({ type: Date, default: null, index: true })
  consumedAt: Date | null;

  @Prop({ required: true })
  emailNormalized: string;

  @Prop({ trim: true })
  name?: string;

  /** CTA / funnel context for analytics and support (no PII beyond name/email on visitor). */
  @Prop({ type: Object })
  ctaContext?: Record<string, unknown>;
}

export const TrialAccessTokenSchema = SchemaFactory.createForClass(TrialAccessToken);
