import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  DocumentModel,
  DocumentSchema,
  KnowledgeBaseItem,
  KnowledgeBaseItemSchema,
  KnowledgeBaseChunk,
  KnowledgeBaseChunkSchema,
} from '../models';
import { RagModule } from '../rag/rag.module';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import { KnowledgeBaseChunkService } from './knowledge-base-chunk.service';
import { KbService } from './kb.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeBaseItem.name, schema: KnowledgeBaseItemSchema },
      { name: KnowledgeBaseChunk.name, schema: KnowledgeBaseChunkSchema },
      { name: Bot.name, schema: BotSchema },
      { name: DocumentModel.name, schema: DocumentSchema },
    ]),
    RagModule,
  ],
  providers: [KnowledgeBaseItemService, KnowledgeBaseChunkService, KbService],
  exports: [KnowledgeBaseItemService, KnowledgeBaseChunkService, KbService, MongooseModule],
})
export class KnowledgeModule {}
