import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BotsController } from './bots.controller';
import { PublicBotsController } from './public-bots.controller';
import { LandingBotsController } from './landing-bots.controller';
import { WidgetInitController } from './widget-init.controller';
import { TrialBotsController } from './trial-bots.controller';
import { LandingTrialCreateAgentController } from './landing-trial-create-agent.controller';
import { PublicVisitorQuotaController } from './public-visitor-quota.controller';
import { PublicVisitorBotController } from './public-visitor-bot.controller';
import { WidgetWebsiteRegisterController } from './widget-website-register.controller';
import { LandingSiteApiKeyModule } from '../landing-site-api-key/landing-site-api-key.module';
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
import { IngestionModule } from '../ingestion/ingestion.module';
import { LandingTrialBotKnowledgeController } from './landing-trial-bot-knowledge.controller';
import { LandingTrialWorkspaceAgentController } from './landing-trial-workspace-agent.controller';
/**
 * Bot-related HTTP surfaces include:
 * - **Anonymous public (rate-limited):** `TrialBotsController`, `PublicVisitorQuotaController`, `PublicVisitorBotController`,
 *   `WidgetWebsiteRegisterController` — see `public-anonymous-rate-limit.*` (RateLimitModule is global).
 * - **Marketing gallery (landing `X-API-Key` + rate limit):** `PublicBotsController`, `LandingBotsController`.
 * - **Internal admin listing (auth):** `BotsController` (`/api/bots`) — not a public gallery; use `/api/public/bots`.
 */
@Module({
  imports: [
    LandingSiteApiKeyModule,
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
    IngestionModule,
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
    LandingTrialCreateAgentController,
    LandingTrialBotKnowledgeController,
    LandingTrialWorkspaceAgentController,
  ],
  providers: [BotsService, ChatWidgetApiKeyGuard, EmbedSessionService],
  exports: [BotsService, EmbedSessionService],
})
export class BotsModule { }
