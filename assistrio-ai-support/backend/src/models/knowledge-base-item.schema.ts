import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** Source type for unified knowledge items (document, faq, note, url, html). */
export const KNOWLEDGE_BASE_ITEM_SOURCE_TYPES = [
  'document',
  'faq',
  'note',
  'url',
  'html',
] as const;
export type KnowledgeBaseItemSourceType = (typeof KNOWLEDGE_BASE_ITEM_SOURCE_TYPES)[number];

export type KnowledgeBaseItemStatus = 'queued' | 'processing' | 'ready' | 'failed';

@Schema({ _id: false })
export class KnowledgeBaseItemSourceMeta {
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
  uploadSessionId?: string;
}

@Schema({ _id: false })
export class KnowledgeBaseItemFaqMeta {
  @Prop()
  question?: string;
  @Prop()
  answer?: string;
  @Prop()
  faqIndex?: number;
}

@Schema({ _id: false })
export class KnowledgeBaseItemNoteMeta {
  @Prop()
  kind?: string;
}

@Schema({ timestamps: true, collection: 'knowledge_base_items' })
export class KnowledgeBaseItem {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  /** Link to DocumentModel (document source only). */
  @Prop({ type: Types.ObjectId, ref: 'DocumentModel', sparse: true })
  documentId?: Types.ObjectId;
  @Prop({ required: true })
  title: string;
  @Prop({
    required: true,
    enum: KNOWLEDGE_BASE_ITEM_SOURCE_TYPES,
  })
  sourceType: KnowledgeBaseItemSourceType;
  @Prop({
    enum: ['queued', 'processing', 'ready', 'failed'],
    default: 'queued',
  })
  status: KnowledgeBaseItemStatus;
  @Prop({ default: true })
  active: boolean;
  @Prop({ default: '' })
  content: string;
  @Prop()
  rawContent?: string;
  @Prop()
  error?: string;
  @Prop()
  contentHash?: string;
  @Prop()
  processedAt?: Date;
  @Prop({ type: KnowledgeBaseItemSourceMeta })
  sourceMeta?: KnowledgeBaseItemSourceMeta;
  @Prop({ type: KnowledgeBaseItemFaqMeta })
  faqMeta?: KnowledgeBaseItemFaqMeta;
  @Prop({ type: KnowledgeBaseItemNoteMeta })
  noteMeta?: KnowledgeBaseItemNoteMeta;
  createdAt?: Date;
  updatedAt?: Date;
}

export const KnowledgeBaseItemSchema = SchemaFactory.createForClass(KnowledgeBaseItem);
KnowledgeBaseItemSchema.index({ botId: 1 });
KnowledgeBaseItemSchema.index({ status: 1 });
KnowledgeBaseItemSchema.index({ documentId: 1 }, { sparse: true });
KnowledgeBaseItemSchema.index({ botId: 1, status: 1, createdAt: -1 });
KnowledgeBaseItemSchema.index({ botId: 1, sourceType: 1, createdAt: -1 });
KnowledgeBaseItemSchema.index({ botId: 1, active: 1, status: 1 });
