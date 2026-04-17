import { Module } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AdminBotsController } from './admin-bots.controller';
import { AdminDocumentsController } from './admin-documents.controller';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminSeedController } from './admin-seed.controller';
import { AdminUploadController } from './admin-upload.controller';
import { CustomerBotsController } from './customer-bots.controller';
import { CustomerBotInsightsController } from './customer-bot-insights.controller';
import { CustomerChatController } from './customer-chat.controller';
import { CustomerDocumentsController } from './customer-documents.controller';
import { OperatorWorkspaceUploadService } from './shared/operator-workspace-upload.service';
import { BotOnboardingService } from './shared/bot-onboarding.service';
import { ShowcaseAgentsPackService } from './shared/showcase-agents-pack.service';

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
    IngestionModule,
    KnowledgeModule,
    AnalyticsModule,
  ],
  controllers: [
    AdminBotsController,
    AdminDocumentsController,
    AdminJobsController,
    AdminSeedController,
    AdminUploadController,
    CustomerBotsController,
    CustomerBotInsightsController,
    CustomerDocumentsController,
    CustomerChatController,
  ],
  providers: [BotOnboardingService, ShowcaseAgentsPackService, OperatorWorkspaceUploadService],
  exports: [],
})
export class WorkspaceModule {}
