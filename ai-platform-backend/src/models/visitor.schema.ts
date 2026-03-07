import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: false })
export class Visitor {
  @Prop({ required: true, unique: true })
  visitorId: string;
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
