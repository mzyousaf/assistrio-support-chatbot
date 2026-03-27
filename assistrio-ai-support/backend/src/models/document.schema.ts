import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: false, collection: 'documents' })
export class DocumentModel {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  @Prop({ required: true })
  title: string;
  @Prop({ required: true, enum: ['upload', 'url', 'manual'] })
  sourceType: string;
  @Prop({ enum: ['queued', 'processing', 'ready', 'failed'], default: 'queued' })
  status?: string;
  @Prop()
  error?: string;
  @Prop()
  ingestedAt?: Date;
  @Prop()
  fileName?: string;
  @Prop()
  fileType?: string;
  @Prop()
  fileSize?: number;
  @Prop()
  url?: string;
  @Prop()
  storage?: string;
  @Prop()
  s3Bucket?: string;
  @Prop()
  s3Key?: string;
  @Prop()
  text?: string;
  @Prop({ default: () => new Date() })
  createdAt: Date;
  /** Optional upload session: when set, used to cancel an in-progress upload and remove all docs from this session. */
  @Prop()
  uploadSessionId?: string;
  /** When false, document is excluded from knowledge base search. Default true. */
  @Prop({ default: true })
  active?: boolean;
}

export const DocumentSchema = SchemaFactory.createForClass(DocumentModel);
DocumentSchema.index({ botId: 1 });
DocumentSchema.index({ status: 1 });
DocumentSchema.index({ botId: 1, status: 1, createdAt: -1 });
DocumentSchema.index({ botId: 1, createdAt: -1 });
