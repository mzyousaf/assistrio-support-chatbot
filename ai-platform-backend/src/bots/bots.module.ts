import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotsController } from './bots.controller';
import { PublicBotsController } from './public-bots.controller';
import { LandingBotsController } from './landing-bots.controller';
import { WidgetInitController } from './widget-init.controller';
import { TrialBotsController } from './trial-bots.controller';
import { LandingSiteApiKeyGuard } from './landing-site-api-key.guard';
import { ChatWidgetApiKeyGuard } from './chat-widget-api-key.guard';
import { WidgetTestingBotController } from './widget-testing-bot.controller';
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
  User,
  UserSchema,
  VisitorEvent,
  VisitorEventSchema,
} from '../models';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { VisitorsModule } from '../visitors/visitors.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Bot.name, schema: BotSchema },
      // Needed for bot cascade deletes (transactional) in BotsService.remove().
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: SummaryJob.name, schema: SummaryJobSchema },
      { name: IngestJob.name, schema: IngestJobSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
    ]),
    KnowledgeModule,
    VisitorsModule,
  ],
  controllers: [BotsController, PublicBotsController, LandingBotsController, WidgetInitController, WidgetTestingBotController, TrialBotsController],
  providers: [BotsService, LandingSiteApiKeyGuard, ChatWidgetApiKeyGuard],
  exports: [BotsService],
})
export class BotsModule { }
