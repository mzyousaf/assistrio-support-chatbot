import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export type FaqNoteEmbeddingJobType = 'faq' | 'note';
export type FaqNoteEmbeddingJobStatus = 'queued' | 'processing' | 'done' | 'failed';

@Schema({ timestamps: true })
export class FaqNoteEmbeddingJob {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  @Prop({ enum: ['faq', 'note'], required: true })
  type: FaqNoteEmbeddingJobType;
  /** For type 'faq', the index in bot.faqs[]. */
  @Prop()
  faqIndex?: number;
  @Prop({ enum: ['queued', 'processing', 'done', 'failed'], required: true })
  status: FaqNoteEmbeddingJobStatus;
  @Prop()
  error?: string;
  @Prop()
  startedAt?: Date;
  @Prop()
  finishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const FaqNoteEmbeddingJobSchema = SchemaFactory.createForClass(FaqNoteEmbeddingJob);
FaqNoteEmbeddingJobSchema.index({ botId: 1 });
FaqNoteEmbeddingJobSchema.index({ status: 1, createdAt: 1 });
