import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExtractJob, ExtractJobSchema, TrainJob, TrainJobSchema } from '../models';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AdminBotConversationsController } from './admin-bot-conversations.controller';
import { AdminBotsController } from './admin-bots.controller';
import { AdminDocumentsController } from './admin-documents.controller';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminSeedController } from './admin-seed.controller';
import { AdminUploadController } from './admin-upload.controller';
import { AdminKnowledgeController } from './admin-knowledge.controller';
import { CustomerKnowledgeController } from './customer-knowledge.controller';
import { CustomerBotsController } from './customer-bots.controller';
import { CustomerBotAiController } from './customer-bot-ai.controller';
import { CustomerBotInsightsController } from './customer-bot-insights.controller';
import { CustomerBotChatsAnalyticsController } from './customer-bot-chats-analytics.controller';
import { CustomerBotLeadsAnalyticsController } from './customer-bot-leads-analytics.controller';
import { CustomerBotTopicsAnalyticsController } from './customer-bot-topics-analytics.controller';
import { CustomerBotSentimentAnalyticsController } from './customer-bot-sentiment-analytics.controller';
import { CustomerBotAgentResourcesAnalyticsController } from './customer-bot-agent-resources-analytics.controller';
import { CustomerBotConversationsController } from './customer-bot-conversations.controller';
import { CustomerBotLeadsController } from './customer-bot-leads.controller';
import { CustomerBotShareController } from './customer-bot-share.controller';
import { CustomerChatController } from './customer-chat.controller';
import { CustomerDocumentsController } from './customer-documents.controller';
import { OperatorWorkspaceUploadService } from './shared/operator-workspace-upload.service';
import { BotOnboardingService } from './shared/bot-onboarding.service';
import { ShowcaseAgentsPackService } from './shared/showcase-agents-pack.service';
import { KnowledgeOverviewService } from './knowledge-overview.service';
import { KnowledgeItemManualRetryService } from './knowledge-item-manual-retry.service';

/**
 * Browser workspace product surface: `/api/admin/*` and `/api/customer/*` bot/document/chat routes.
 * Shared implementation lives under `./shared/*`.
 */
@Module({
  imports: [
    AuthModule,
    WorkspacesModule,
    BotsModule,
    ChatModule,
    DocumentsModule,
    IngestionModule.forRoot({ registerHttpControllers: true }),
    KnowledgeModule,
    AnalyticsModule,
    /** Extract + train job models for {@link KnowledgeOverviewService}. */
    MongooseModule.forFeature([
      { name: ExtractJob.name, schema: ExtractJobSchema },
      { name: TrainJob.name, schema: TrainJobSchema },
    ]),
  ],
  controllers: [
    AdminBotConversationsController,
    AdminBotsController,
    AdminKnowledgeController,
    AdminDocumentsController,
    AdminJobsController,
    AdminSeedController,
    AdminUploadController,
    CustomerBotsController,
    CustomerBotAiController,
    CustomerKnowledgeController,
    CustomerBotInsightsController,
    CustomerBotChatsAnalyticsController,
    CustomerBotLeadsAnalyticsController,
    CustomerBotTopicsAnalyticsController,
    CustomerBotSentimentAnalyticsController,
    CustomerBotAgentResourcesAnalyticsController,
    CustomerBotConversationsController,
    CustomerBotLeadsController,
    CustomerBotShareController,
    CustomerDocumentsController,
    CustomerChatController,
  ],
  providers: [
    BotOnboardingService,
    ShowcaseAgentsPackService,
    OperatorWorkspaceUploadService,
    KnowledgeOverviewService,
    KnowledgeItemManualRetryService,
  ],
  exports: [],
})
export class WorkspaceModule {}
