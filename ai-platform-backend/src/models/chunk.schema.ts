import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: false })
export class Chunk {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Document', required: true })
  documentId: Types.ObjectId;
  @Prop({ required: true })
  text: string;
  @Prop({ type: [Number], required: true })
  embedding: number[];
  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ChunkSchema = SchemaFactory.createForClass(Chunk);
ChunkSchema.index({ botId: 1 });
ChunkSchema.index({ documentId: 1 });
ChunkSchema.index({ botId: 1, createdAt: -1 });
