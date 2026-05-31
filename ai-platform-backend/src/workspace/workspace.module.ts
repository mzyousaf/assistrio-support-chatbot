import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExtractJob, ExtractJobSchema, TrainJob, TrainJobSchema, Bot, BotSchema, Workspace, WorkspaceSchema, WorkspaceOnboardingDraft, WorkspaceOnboardingDraftSchema, User, UserSchema, WorkspaceMembership, WorkspaceMembershipSchema, WorkspaceSubscription, WorkspaceSubscriptionSchema, UsageLedger, UsageLedgerSchema } from '../models';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { BillingModule } from '../billing/billing.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AdminBillingWebhookController } from './admin-billing-webhook.controller';
import { AdminWorkspaceBillingController } from './admin-workspace-billing.controller';
import { AdminBotConversationsController } from './admin-bot-conversations.controller';
import { AdminBotsController } from './admin-bots.controller';
import { AdminDocumentsController } from './admin-documents.controller';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminSeedController } from './admin-seed.controller';
import { AdminUploadController } from './admin-upload.controller';
import { AdminKnowledgeController } from './admin-knowledge.controller';
import { CustomerKnowledgeController } from './customer-knowledge.controller';
import { CustomerWorkspaceEntitlementsController } from './customer-workspace-entitlements.controller';
import { CustomerWorkspaceBillingController } from './customer-workspace-billing.controller';
import { CustomerWorkspaceBillingCheckoutController } from './customer-workspace-billing-checkout.controller';
import { CustomerWorkspaceActiveController } from './customer-workspace-active.controller';
import { CustomerWorkspaceController } from './customer-workspace.controller';
import { CustomerWorkspaceMembersController } from './customer-workspace-members.controller';
import { CustomerWorkspaceSettingsController } from './customer-workspace-settings.controller';
import { CustomerWorkspaceInviteController } from './customer-workspace-invite.controller';
import { CustomerWorkspaceOnboardingController } from './customer-workspace-onboarding.controller';
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
import { CustomerBotReportsExportController } from './customer-bot-reports-export.controller';
import { CustomerBotShareController } from './customer-bot-share.controller';
import { CustomerChatController } from './customer-chat.controller';
import { CustomerDocumentsController } from './customer-documents.controller';
import { OperatorWorkspaceUploadService } from './shared/operator-workspace-upload.service';
import { BotOnboardingService } from './shared/bot-onboarding.service';
import { ShowcaseAgentsPackService } from './shared/showcase-agents-pack.service';
import { KnowledgeOverviewService } from './knowledge-overview.service';
import { KnowledgeItemManualRetryService } from './knowledge-item-manual-retry.service';
import { WorkspaceOnboardingGoLiveService } from './workspace-onboarding-go-live.service';
import { WorkspaceAddon, WorkspaceAddonSchema } from '../models/workspace-addon.schema';
import { WorkspaceCreditTopUp, WorkspaceCreditTopUpSchema } from '../models/workspace-credit-top-up.schema';
import {
  WorkspaceBillingOrder,
  WorkspaceBillingOrderSchema,
} from '../models/workspace-billing-order.schema';
import { WorkspaceBillingSummaryService } from './workspace-billing-summary.service';
import { WorkspaceUsageAnalyticsService } from './workspace-usage-analytics.service';
import { OnboardingKbTransferModule } from './onboarding-kb-transfer.module';

/**
 * Browser workspace product surface: `/api/admin/*` and `/api/customer/*` bot/document/chat routes.
 * Shared implementation lives under `./shared/*`.
 */
@Module({
  imports: [
    AuthModule,
    EntitlementsModule,
    BillingModule,
    WorkspacesModule,
    OnboardingKbTransferModule,
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
      { name: Bot.name, schema: BotSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceOnboardingDraft.name, schema: WorkspaceOnboardingDraftSchema },
      { name: User.name, schema: UserSchema },
      { name: WorkspaceMembership.name, schema: WorkspaceMembershipSchema },
      { name: WorkspaceSubscription.name, schema: WorkspaceSubscriptionSchema },
      { name: WorkspaceAddon.name, schema: WorkspaceAddonSchema },
      { name: WorkspaceCreditTopUp.name, schema: WorkspaceCreditTopUpSchema },
      { name: WorkspaceBillingOrder.name, schema: WorkspaceBillingOrderSchema },
      { name: UsageLedger.name, schema: UsageLedgerSchema },
    ]),
  ],
  controllers: [
    AdminWorkspaceBillingController,
    AdminBillingWebhookController,
    AdminBotConversationsController,
    AdminBotsController,
    AdminKnowledgeController,
    AdminDocumentsController,
    AdminJobsController,
    AdminSeedController,
    AdminUploadController,
    CustomerBotsController,
    CustomerWorkspaceEntitlementsController,
    CustomerWorkspaceBillingController,
    CustomerWorkspaceBillingCheckoutController,
    CustomerWorkspaceActiveController,
    CustomerWorkspaceController,
    CustomerWorkspaceMembersController,
    CustomerWorkspaceSettingsController,
    CustomerWorkspaceInviteController,
    CustomerWorkspaceOnboardingController,
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
    CustomerBotReportsExportController,
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
    WorkspaceOnboardingGoLiveService,
    WorkspaceBillingSummaryService,
    WorkspaceUsageAnalyticsService,
  ],
  exports: [],
})
export class WorkspaceModule {}
