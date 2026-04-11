import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Opaque dashboard session after magic-link verify. Cookie holds raw token; DB stores SHA-256 hash only.
 */
@Schema({ collection: 'trial_dashboard_sessions', timestamps: { createdAt: true, updatedAt: false } })
export class TrialDashboardSession {
  /** SHA-256 hex of the opaque session token issued to the browser (httpOnly cookie). */
  @Prop({ required: true, unique: true, index: true })
  sessionTokenHash: string;

  @Prop({ required: true, index: true })
  platformVisitorId: string;

  @Prop({ required: true })
  emailNormalized: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;
}

export const TrialDashboardSessionSchema = SchemaFactory.createForClass(TrialDashboardSession);
TrialDashboardSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
