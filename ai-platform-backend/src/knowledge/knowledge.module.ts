import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  Conversation,
  ConversationSchema,
  ExtractJob,
  ExtractJobSchema,
  Message,
  MessageSchema,
  KnowledgeBaseItem,
  KnowledgeBaseItemSchema,
  KnowledgeBaseChunk,
  KnowledgeBaseChunkSchema,
  TrainJob,
  TrainJobSchema,
  SummaryJob,
  SummaryJobSchema,
  TableImportJob,
  TableImportJobSchema,
  TableImportSession,
  TableImportSessionSchema,
  VisitorEvent,
  VisitorEventSchema,
} from '../models';
import { RagModule } from '../rag/rag.module';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import { KnowledgeBaseChunkService } from './knowledge-base-chunk.service';
import { KnowledgeTrainingJobService } from './knowledge-training-job.service';
import { KbService } from './kb.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { KnowledgeBaseItemAccessService } from './knowledge-base-item-access.service';
import { KnowledgeExtractionStatusBackfillService } from './knowledge-extraction-status-backfill.service';
import { KnowledgeItemPurgeService } from './knowledge-item-purge.service';
import { BotPurgeService } from './bot-purge.service';
import { KnowledgeUsageService } from './knowledge-usage.service';
import { BotKnowledgeTotalLimitService } from './bot-knowledge-total-limit.service';
import { KnowledgeOosReconcileService } from './knowledge-oos-reconcile.service';
import { KnowledgeTrainKbDriftReconcileService } from './knowledge-train-kb-drift-reconcile.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    EntitlementsModule,
    MongooseModule.forFeature([
      { name: KnowledgeBaseItem.name, schema: KnowledgeBaseItemSchema },
      { name: KnowledgeBaseChunk.name, schema: KnowledgeBaseChunkSchema },
      { name: Bot.name, schema: BotSchema },
      { name: TrainJob.name, schema: TrainJobSchema },
      { name: ExtractJob.name, schema: ExtractJobSchema },
      { name: TableImportJob.name, schema: TableImportJobSchema },
      { name: TableImportSession.name, schema: TableImportSessionSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
      { name: SummaryJob.name, schema: SummaryJobSchema },
    ]),
    RagModule,
  ],
  providers: [
    KnowledgeBaseItemAccessService,
    KnowledgeBaseItemService,
    KnowledgeBaseChunkService,
    KnowledgeTrainingJobService,
    KnowledgeStatsService,
    KbService,
    KnowledgeExtractionStatusBackfillService,
    KnowledgeUsageService,
    BotKnowledgeTotalLimitService,
    KnowledgeItemPurgeService,
    BotPurgeService,
    KnowledgeOosReconcileService,
    KnowledgeTrainKbDriftReconcileService,
  ],
  exports: [
    KnowledgeBaseItemAccessService,
    KnowledgeBaseItemService,
    KnowledgeBaseChunkService,
    KnowledgeTrainingJobService,
    KnowledgeStatsService,
    KnowledgeUsageService,
    BotKnowledgeTotalLimitService,
    KnowledgeOosReconcileService,
    KnowledgeTrainKbDriftReconcileService,
    KbService,
    KnowledgeItemPurgeService,
    BotPurgeService,
    MongooseModule,
  ],
})
export class KnowledgeModule {}
