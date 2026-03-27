import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export type IngestJobStatus = 'queued' | 'processing' | 'done' | 'failed';

@Schema({ timestamps: true })
export class IngestJob {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Document', required: true })
  docId: Types.ObjectId;
  @Prop({
    required: true,
    enum: ['queued', 'processing', 'done', 'failed'],
  })
  status: IngestJobStatus;
  @Prop()
  error?: string;
  @Prop()
  startedAt?: Date;
  @Prop()
  finishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const IngestJobSchema = SchemaFactory.createForClass(IngestJob);
IngestJobSchema.index({ botId: 1 });
IngestJobSchema.index({ status: 1 });
IngestJobSchema.index({ status: 1, createdAt: 1 });
IngestJobSchema.index({ botId: 1, createdAt: -1 });
IngestJobSchema.index({ docId: 1 });
