import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema } from '../models/bot.schema';
import { UsageLedger, UsageLedgerSchema } from '../models/usage-ledger.schema';
import {
  WorkspaceInvite,
  WorkspaceInviteSchema,
  WorkspaceMembership,
  WorkspaceMembershipSchema,
  WorkspaceSubscription,
  WorkspaceSubscriptionSchema,
} from '../models';
import { WorkspaceAiCreditGateService } from './workspace-ai-credit-gate.service';
import { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';
import { WorkspaceAnalyticsEntitlementService } from './workspace-analytics-entitlement.service';
import { WorkspaceBrandingEntitlementService } from './workspace-branding-entitlement.service';
import { WorkspaceExportReportEntitlementService } from './workspace-export-report-entitlement.service';
import { WorkspaceBotLimitService } from './workspace-bot-limit.service';
import { BotKnowledgeSizeResolverService } from './bot-knowledge-size-resolver.service';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import { WorkspaceMemberLimitService } from './workspace-member-limit.service';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkspaceSubscription.name, schema: WorkspaceSubscriptionSchema },
      { name: Bot.name, schema: BotSchema },
      { name: UsageLedger.name, schema: UsageLedgerSchema },
      { name: WorkspaceMembership.name, schema: WorkspaceMembershipSchema },
      { name: WorkspaceInvite.name, schema: WorkspaceInviteSchema },
    ]),
  ],
  providers: [
    WorkspaceSubscriptionsService,
    WorkspaceEntitlementsService,
    WorkspaceBotLimitService,
    WorkspaceMemberLimitService,
    WorkspaceAiCreditsUsageService,
    WorkspaceAiCreditGateService,
    WorkspaceBrandingEntitlementService,
    WorkspaceAnalyticsEntitlementService,
    WorkspaceExportReportEntitlementService,
    BotKnowledgeSizeResolverService,
  ],
  exports: [
    WorkspaceSubscriptionsService,
    WorkspaceEntitlementsService,
    WorkspaceBotLimitService,
    WorkspaceMemberLimitService,
    WorkspaceAiCreditsUsageService,
    WorkspaceAiCreditGateService,
    WorkspaceBrandingEntitlementService,
    WorkspaceAnalyticsEntitlementService,
    WorkspaceExportReportEntitlementService,
    BotKnowledgeSizeResolverService,
  ],
})
export class EntitlementsModule {}
