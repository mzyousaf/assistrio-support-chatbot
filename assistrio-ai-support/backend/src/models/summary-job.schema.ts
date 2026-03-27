import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export type SummaryJobStatus = 'queued' | 'processing' | 'done' | 'failed';

@Schema({ timestamps: true })
export class SummaryJob {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  @Prop({ enum: ['queued', 'processing', 'done', 'failed'], required: true })
  status: SummaryJobStatus;
  @Prop()
  error?: string;
  @Prop()
  startedAt?: Date;
  @Prop()
  finishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SummaryJobSchema = SchemaFactory.createForClass(SummaryJob);
SummaryJobSchema.index({ status: 1, createdAt: 1 });
SummaryJobSchema.index({ conversationId: 1 });
