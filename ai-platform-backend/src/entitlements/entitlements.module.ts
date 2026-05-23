import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema } from '../models/bot.schema';
import { UsageLedger, UsageLedgerSchema } from '../models/usage-ledger.schema';
import {
  WorkspaceSubscription,
  WorkspaceSubscriptionSchema,
} from '../models/workspace-subscription.schema';
import { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';
import { WorkspaceBotLimitService } from './workspace-bot-limit.service';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkspaceSubscription.name, schema: WorkspaceSubscriptionSchema },
      { name: Bot.name, schema: BotSchema },
      { name: UsageLedger.name, schema: UsageLedgerSchema },
    ]),
  ],
  providers: [
    WorkspaceSubscriptionsService,
    WorkspaceEntitlementsService,
    WorkspaceBotLimitService,
    WorkspaceAiCreditsUsageService,
  ],
  exports: [
    WorkspaceSubscriptionsService,
    WorkspaceEntitlementsService,
    WorkspaceBotLimitService,
    WorkspaceAiCreditsUsageService,
  ],
})
export class EntitlementsModule {}
