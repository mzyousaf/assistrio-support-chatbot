import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotsController } from './bots.controller';
import { PublicBotsController } from './public-bots.controller';
import { WidgetInitController } from './widget-init.controller';
import { BotsService } from './bots.service';
import {
  Bot,
  BotSchema,
  Conversation,
  ConversationSchema,
  IngestJob,
  IngestJobSchema,
  Message,
  MessageSchema,
  SummaryJob,
  SummaryJobSchema,
  VisitorEvent,
  VisitorEventSchema,
} from '../models';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bot.name, schema: BotSchema },
      // Needed for bot cascade deletes (transactional) in BotsService.remove().
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: SummaryJob.name, schema: SummaryJobSchema },
      { name: IngestJob.name, schema: IngestJobSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
    ]),
    KnowledgeModule,
  ],
  controllers: [BotsController, PublicBotsController, WidgetInitController],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule { }
