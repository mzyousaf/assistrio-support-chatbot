import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: false })
export class RateLimit {
  @Prop({ required: true })
  key: string;
  @Prop({ required: true })
  windowStart: Date;
  @Prop({ required: true, default: 0 })
  count: number;
}

export const RateLimitSchema = SchemaFactory.createForClass(RateLimit);
RateLimitSchema.index({ key: 1 });
RateLimitSchema.index({ windowStart: 1 });
RateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
