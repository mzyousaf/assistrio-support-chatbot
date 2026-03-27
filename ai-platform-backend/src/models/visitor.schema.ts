import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Platform (marketing / trial) vs embed chat widget identity — both live in `visitors`. */
export type VisitorKind = 'platform' | 'chat';

@Schema({ timestamps: false })
export class Visitor {
  /**
   * External id: `platformVisitorId` (e.g. `v_…`) or `chatVisitorId` (e.g. `c_…`).
   * Uniqueness is per {@link VisitorKind} — see compound index below.
   */
  @Prop({ required: true })
  visitorId: string;

  @Prop({ required: true, enum: ['platform', 'chat'], default: 'platform' })
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
  @Prop({ default: Date.now })
  createdAt: Date;
  @Prop({ default: Date.now })
  lastSeenAt: Date;
}

export const VisitorSchema = SchemaFactory.createForClass(Visitor);
VisitorSchema.index({ visitorId: 1, visitorType: 1 }, { unique: true });
