import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BotsController } from './bots.controller';
import { PublicBotsController } from './public-bots.controller';
import { LandingBotsController } from './landing-bots.controller';
import { WidgetInitController } from './widget-init.controller';
import { TrialBotsController } from './trial-bots.controller';
import { PublicVisitorQuotaController } from './public-visitor-quota.controller';
import { PublicVisitorBotController } from './public-visitor-bot.controller';
import { WidgetWebsiteRegisterController } from './widget-website-register.controller';
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
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DocumentsModule } from '../documents/documents.module';
/**
 * Bot-related HTTP surfaces include:
 * - **Anonymous public (rate-limited):** `TrialBotsController`, `PublicVisitorQuotaController`, `PublicVisitorBotController`,
 *   `WidgetWebsiteRegisterController`, `PublicBotsController` — see `public-anonymous-rate-limit.*` (RateLimitModule is global).
 * - **Landing (API key + rate limit):** `LandingBotsController`.
 * - **Internal admin listing (auth):** `BotsController` (`/api/bots`) — not a public gallery; use `/api/public/bots`.
 */
@Module({
  imports: [
    AuthModule,
    WorkspacesModule,
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
    DocumentsModule,
  ],
  controllers: [
    BotsController,
    PublicBotsController,
    PublicVisitorQuotaController,
    PublicVisitorBotController,
    LandingBotsController,
    WidgetInitController,
    WidgetWebsiteRegisterController,
    WidgetTestingBotController,
    TrialBotsController,
  ],
  providers: [BotsService, LandingSiteApiKeyGuard, ChatWidgetApiKeyGuard, EmbedSessionService],
  exports: [BotsService, EmbedSessionService],
})
export class BotsModule { }
