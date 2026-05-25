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
import { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';
import { WorkspaceBotLimitService } from './workspace-bot-limit.service';
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
  ],
  exports: [
    WorkspaceSubscriptionsService,
    WorkspaceEntitlementsService,
    WorkspaceBotLimitService,
    WorkspaceMemberLimitService,
    WorkspaceAiCreditsUsageService,
  ],
})
export class EntitlementsModule {}
