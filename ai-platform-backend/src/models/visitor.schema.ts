import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * `marketing` — anonymous site analytics id (funnels).
 * `chat` — embed widget thread identity mirror.
 * `owner_preview` — legacy owner-preview counter rows (visitorId = user ObjectId string); preview now uses per-IP embed limits instead of this quota.
 * `platform` — legacy marketing rows (treated like marketing in reads).
 */
export type VisitorKind = 'marketing' | 'chat' | 'owner_preview' | 'platform';

@Schema({ timestamps: false })
export class Visitor {
  /**
   * External id: analytics `visitorId`, embed `chatVisitorId`, or legacy ids.
   * Uniqueness is per {@link VisitorKind} — see compound index below.
   */
  @Prop({ required: true })
  visitorId: string;

  @Prop({ required: true, enum: ['marketing', 'chat', 'owner_preview', 'platform'], default: 'marketing' })
  visitorType: VisitorKind;
  @Prop()
  name?: string;
  @Prop()
  email?: string;
  @Prop()
  phone?: string;
  @Prop()
  limitOverrideMessages?: number;
  @Prop({ default: 0 })
  showcaseMessageCount: number;
  @Prop({ default: 0 })
  ownBotMessageCount: number;
  /** @deprecated Prefer {@link previewUserMessageCount}. */
  @Prop({ default: 0 })
  trialPreviewUserMessageCount: number;
  /** Legacy counter when `visitorType` was `owner_preview` (per-account preview cap; no longer enforced). */
  @Prop({ default: 0 })
  previewUserMessageCount: number;
  @Prop({ default: Date.now })
  createdAt: Date;
  @Prop({ default: Date.now })
  lastSeenAt: Date;
}

export const VisitorSchema = SchemaFactory.createForClass(Visitor);
VisitorSchema.index({ visitorId: 1, visitorType: 1 }, { unique: true });
