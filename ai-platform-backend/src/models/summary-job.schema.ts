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
  /**
   * Enqueue dedupe bucket (60s window): prevents duplicate live jobs for one conversation/bot
   * during concurrent enqueue races, while allowing later windows after done/failed completion.
   */
  @Prop({ required: true, min: 0 })
  enqueueWindowSlot: number;
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
SummaryJobSchema.index(
  { botId: 1, conversationId: 1, enqueueWindowSlot: 1 },
  {
    unique: true,
    name: 'summary_live_enqueue_window_unique',
    partialFilterExpression: {
      status: { $in: ['queued', 'processing'] },
      enqueueWindowSlot: { $exists: true, $type: 'number' },
    },
  },
);
