import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: false })
export class Config {
  @Prop({ required: true, unique: true })
  key: string;
  @Prop({ type: Object, required: true })
  data: Record<string, unknown>;
  @Prop({ default: Date.now })
  createdAt: Date;
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ConfigSchema = SchemaFactory.createForClass(Config);
