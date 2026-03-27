import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  KnowledgeBaseItem,
  KnowledgeBaseItemSchema,
  KnowledgeBaseChunk,
  KnowledgeBaseChunkSchema,
} from '../models';
import { RagService } from './rag.service';
import { UnifiedKnowledgeRetrievalService } from './unified-knowledge-retrieval.service';
import { KnowledgeBaseRetrievalService } from '../knowledge/knowledge-base-retrieval.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bot.name, schema: BotSchema },
      { name: KnowledgeBaseItem.name, schema: KnowledgeBaseItemSchema },
      { name: KnowledgeBaseChunk.name, schema: KnowledgeBaseChunkSchema },
    ]),
  ],
  providers: [RagService, UnifiedKnowledgeRetrievalService, KnowledgeBaseRetrievalService],
  exports: [RagService, UnifiedKnowledgeRetrievalService],
})
export class RagModule {}
