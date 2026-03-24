import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  KNOWLEDGE_BASE_ITEM_SOURCE_TYPES,
  type KnowledgeBaseItemSourceType,
} from './knowledge-base-item.schema';

@Schema({ timestamps: true, collection: 'knowledge_base_chunks' })
export class KnowledgeBaseChunk {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'KnowledgeBaseItem', required: true })
  knowledgeBaseItemId: Types.ObjectId;
  @Prop({
    required: true,
    enum: KNOWLEDGE_BASE_ITEM_SOURCE_TYPES,
  })
  sourceType: KnowledgeBaseItemSourceType;
  @Prop({ required: true })
  text: string;
  @Prop({ type: [Number], required: true })
  embedding: number[];
  @Prop({ required: true })
  chunkIndex: number;
  @Prop()
  heading?: string;
  @Prop()
  sectionPath?: string;
  @Prop()
  tokenCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const KnowledgeBaseChunkSchema = SchemaFactory.createForClass(KnowledgeBaseChunk);
KnowledgeBaseChunkSchema.index({ botId: 1 });
KnowledgeBaseChunkSchema.index({ knowledgeBaseItemId: 1 });
KnowledgeBaseChunkSchema.index({ botId: 1, knowledgeBaseItemId: 1 });
KnowledgeBaseChunkSchema.index({ botId: 1, createdAt: -1 });
