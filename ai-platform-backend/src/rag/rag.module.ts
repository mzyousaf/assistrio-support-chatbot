import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema, Chunk, ChunkSchema, DocumentModel, DocumentSchema } from '../models';
import { RagService } from './rag.service';
import { UnifiedKnowledgeRetrievalService } from './unified-knowledge-retrieval.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chunk.name, schema: ChunkSchema },
      { name: DocumentModel.name, schema: DocumentSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
  ],
  providers: [RagService, UnifiedKnowledgeRetrievalService],
  exports: [RagService, UnifiedKnowledgeRetrievalService],
})
export class RagModule {}
