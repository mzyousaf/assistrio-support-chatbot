import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BotsController } from './bots.controller';
import { PublicBotsController } from './public-bots.controller';
import { PublicPlatformBotsController } from './public-platform-bots.controller';
import { LandingBotsController } from './landing-bots.controller';
import { WidgetInitController } from './widget-init.controller';
import { LandingSiteApiKeyGuard } from './landing-site-api-key.guard';
import { ChatWidgetApiKeyGuard } from './chat-widget-api-key.guard';
import { WidgetTestingBotController } from './widget-testing-bot.controller';
import { BotsService } from './bots.service';
import { EmbedSessionService } from './embed-session.service';
import {
  Bot,
  BotSchema,
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
  User,
  UserSchema,
  VisitorEvent,
  VisitorEventSchema,
  TableImportJob,
  TableImportJobSchema,
} from '../models';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { DocumentsModule } from '../documents/documents.module';
/**
 * Bot-related HTTP surfaces include:
 * - **Anonymous public (rate-limited):** `PublicBotsController` — see `public-anonymous-rate-limit.*` (RateLimitModule is global).
 * - **Landing (API key + rate limit):** `LandingBotsController`.
 * - **Internal admin listing (auth):** `BotsController` (`/api/bots`) — not a public gallery; use `/api/public/bots`.
 */
@Module({
  imports: [
    AuthModule,
    WorkspacesModule,
    EntitlementsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Bot.name, schema: BotSchema },
      // Needed for bot cascade deletes (transactional) in BotsService.remove().
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: SummaryJob.name, schema: SummaryJobSchema },
      { name: ExtractJob.name, schema: ExtractJobSchema },
      { name: TrainJob.name, schema: TrainJobSchema },
      { name: TableImportJob.name, schema: TableImportJobSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
    ]),
    KnowledgeModule,
    VisitorsModule,
    DocumentsModule,
  ],
  controllers: [
    BotsController,
    PublicBotsController,
    PublicPlatformBotsController,
    LandingBotsController,
    WidgetInitController,
    WidgetTestingBotController,
  ],
  providers: [BotsService, LandingSiteApiKeyGuard, ChatWidgetApiKeyGuard, EmbedSessionService],
  exports: [BotsService, EmbedSessionService],
})
export class BotsModule { }
