import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * `marketing` — anonymous site analytics id (funnels).
 * `chat` — embed widget thread identity mirror.
 * `owner_preview` — authenticated owner preview message quota (visitorId = user ObjectId string).
 * `platform` — legacy marketing rows (treated like marketing in reads).
 */
export type VisitorKind = 'marketing' | 'chat' | 'owner_preview' | 'platform';

@Schema({ timestamps: false })
export class Visitor {
  /**
   * External id: analytics `visitorId`, embed `chatVisitorId`, or owner user id for preview quota.
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
  /** Owner preview quota (`/api/widget/preview/chat`), cap 50 — used with visitorType `owner_preview` only. */
  @Prop({ default: 0 })
  previewUserMessageCount: number;
  @Prop({ default: Date.now })
  createdAt: Date;
  @Prop({ default: Date.now })
  lastSeenAt: Date;
}

export const VisitorSchema = SchemaFactory.createForClass(Visitor);
VisitorSchema.index({ visitorId: 1, visitorType: 1 }, { unique: true });
