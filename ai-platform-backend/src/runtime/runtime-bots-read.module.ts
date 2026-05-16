import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Conversation,
  ConversationSchema,
  ExtractJob,
  ExtractJobSchema,
  TrainJob,
  TrainJobSchema,
  Message,
  MessageSchema,
  SummaryJob,
  SummaryJobSchema,
  VisitorEvent,
  VisitorEventSchema,
} from '../models';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BotsService } from '../bots/bots.service';
import { EmbedSessionService } from '../bots/embed-session.service';
import { WidgetInitController } from '../bots/widget-init.controller';
import { RuntimeAuthCoreModule } from './runtime-auth-core.module';
import { VisitorsRuntimeModule } from './visitors-runtime.module';

/**
 * Public embed `POST /api/widget/init` and shared bot/session services used by the chat module.
 * Carries a full `BotsService` (same as API) to avoid behaviour drift; does **not** register
 * public gallery, landing, admin bot listing, or testing controllers.
 */
@Module({
  imports: [
    RuntimeAuthCoreModule,
    KnowledgeModule,
    WorkspacesModule,
    VisitorsRuntimeModule,
    /** Models required by `BotsService` (see `src/bots/bots.service.ts` constructor). */
    MongooseModule.forFeature([
      { name: ExtractJob.name, schema: ExtractJobSchema },
      { name: TrainJob.name, schema: TrainJobSchema },
      { name: SummaryJob.name, schema: SummaryJobSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
    ]),
  ],
  providers: [BotsService, EmbedSessionService],
  controllers: [WidgetInitController],
  exports: [BotsService, EmbedSessionService],
})
export class RuntimeBotsReadModule {}
