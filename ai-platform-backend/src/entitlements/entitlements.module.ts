import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingModule } from '../billing/billing.module';
import { EmailModule } from '../email/email.module';
import { Bot, BotSchema } from '../models/bot.schema';
import { UsageLedger, UsageLedgerSchema } from '../models/usage-ledger.schema';
import { User, UserSchema } from '../models/user.schema';
import { Workspace, WorkspaceSchema } from '../models/workspace.schema';
import {
  WorkspaceAddon,
  WorkspaceAddonSchema,
  WorkspaceCreditTopUp,
  WorkspaceCreditTopUpSchema,
  WorkspaceInvite,
  WorkspaceInviteSchema,
  WorkspaceMembership,
  WorkspaceMembershipSchema,
  WorkspaceSubscription,
  WorkspaceSubscriptionSchema,
} from '../models';
import { WorkspaceCreditTopUpService } from './workspace-credit-topup.service';
import { WorkspaceAiCreditGateService } from './workspace-ai-credit-gate.service';
import { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';
import { WorkspaceAnalyticsEntitlementService } from './workspace-analytics-entitlement.service';
import { WorkspaceBrandingEntitlementService } from './workspace-branding-entitlement.service';
import { WorkspaceExportReportEntitlementService } from './workspace-export-report-entitlement.service';
import { WorkspaceSharePreviewEntitlementService } from './workspace-share-preview-entitlement.service';
import { WorkspaceBotLimitService } from './workspace-bot-limit.service';
import { BotKnowledgeSizeResolverService } from './bot-knowledge-size-resolver.service';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import { WorkspaceMemberLimitService } from './workspace-member-limit.service';
import { WorkspaceMemberOverLimitReconcileService } from './workspace-member-over-limit-reconcile.service';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';
import { TrialEmailService } from './trial-email.service';
import { TrialReminderCron } from './trial-reminder.cron';
import { TrialReminderService } from './trial-reminder.service';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    forwardRef(() => BillingModule),
    MongooseModule.forFeature([
      { name: WorkspaceSubscription.name, schema: WorkspaceSubscriptionSchema },
      { name: WorkspaceAddon.name, schema: WorkspaceAddonSchema },
      { name: WorkspaceCreditTopUp.name, schema: WorkspaceCreditTopUpSchema },
      { name: Bot.name, schema: BotSchema },
      { name: UsageLedger.name, schema: UsageLedgerSchema },
      { name: WorkspaceMembership.name, schema: WorkspaceMembershipSchema },
      { name: WorkspaceInvite.name, schema: WorkspaceInviteSchema },
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
  ],
  providers: [
    WorkspaceSubscriptionsService,
    TrialEmailService,
    TrialReminderService,
    TrialReminderCron,
    WorkspaceCreditTopUpService,
    WorkspaceEntitlementsService,
    WorkspaceBotLimitService,
    WorkspaceMemberLimitService,
    WorkspaceMemberOverLimitReconcileService,
    WorkspaceAiCreditsUsageService,
    WorkspaceAiCreditGateService,
    WorkspaceBrandingEntitlementService,
    WorkspaceAnalyticsEntitlementService,
    WorkspaceExportReportEntitlementService,
    WorkspaceSharePreviewEntitlementService,
    BotKnowledgeSizeResolverService,
  ],
  exports: [
    WorkspaceSubscriptionsService,
    WorkspaceCreditTopUpService,
    WorkspaceEntitlementsService,
    WorkspaceBotLimitService,
    WorkspaceMemberLimitService,
    WorkspaceMemberOverLimitReconcileService,
    WorkspaceAiCreditsUsageService,
    WorkspaceAiCreditGateService,
    WorkspaceBrandingEntitlementService,
    WorkspaceAnalyticsEntitlementService,
    WorkspaceExportReportEntitlementService,
    WorkspaceSharePreviewEntitlementService,
    BotKnowledgeSizeResolverService,
  ],
})
export class EntitlementsModule {}
