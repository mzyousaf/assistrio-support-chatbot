import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailModule } from '../email/email.module';
import { User, UserSchema, WorkspaceMembership, WorkspaceMembershipSchema } from '../models';
import {
  BillingWebhookEventRecord,
  BillingWebhookEventSchema,
} from '../models/billing-webhook-event.schema';
import { WorkspaceAddon, WorkspaceAddonSchema } from '../models/workspace-addon.schema';
import {
  WorkspaceCreditTopUp,
  WorkspaceCreditTopUpSchema,
} from '../models/workspace-credit-top-up.schema';
import {
  WorkspaceBillingOrder,
  WorkspaceBillingOrderSchema,
} from '../models/workspace-billing-order.schema';
import {
  WorkspaceBillingProfile,
  WorkspaceBillingProfileSchema,
} from '../models/workspace-billing-profile.schema';
import {
  WorkspaceSubscription,
  WorkspaceSubscriptionSchema,
} from '../models/workspace-subscription.schema';
import { Workspace, WorkspaceSchema } from '../models/workspace.schema';
import { Bot, BotSchema } from '../models/bot.schema';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { BillingProviderService } from './billing-provider.service';
import { BillingCheckoutService } from './billing-checkout.service';
import { BillingManageService } from './billing-manage.service';
import { BillingAdminSyncService } from './billing-admin-sync.service';
import { BillingAdminWebhookReplayService } from './billing-admin-webhook-replay.service';
import { BillingWebhookAlertService } from './billing-webhook-alert.service';
import { BillingWebhookEventsService } from './billing-webhook-events.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import { BillingWebhooksController } from './billing-webhooks.controller';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingWorkspacePaymentNotificationService } from './billing-workspace-payment-notification.service';
import { BillingSubscriptionActionsService } from './billing-subscription-actions.service';
import { BillingAddonActionsService } from './billing-addon-actions.service';
import { BillingProfileService } from './billing-profile.service';
import { LemonSqueezyProvider } from './providers/lemon-squeezy.provider';

@Module({
  imports: [
    EntitlementsModule,
    EmailModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: WorkspaceMembership.name, schema: WorkspaceMembershipSchema },
      { name: BillingWebhookEventRecord.name, schema: BillingWebhookEventSchema },
      { name: WorkspaceSubscription.name, schema: WorkspaceSubscriptionSchema },
      { name: WorkspaceAddon.name, schema: WorkspaceAddonSchema },
      { name: WorkspaceCreditTopUp.name, schema: WorkspaceCreditTopUpSchema },
      { name: WorkspaceBillingOrder.name, schema: WorkspaceBillingOrderSchema },
      { name: WorkspaceBillingProfile.name, schema: WorkspaceBillingProfileSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
  ],
  controllers: [BillingWebhooksController],
  providers: [
    LemonSqueezyProvider,
    BillingProviderService,
    BillingCheckoutService,
    BillingManageService,
    BillingAdminSyncService,
    BillingAdminWebhookReplayService,
    BillingWebhookEventsService,
    BillingWebhookAlertService,
    BillingWebhookProcessingService,
    BillingInvoicesService,
    BillingProfileService,
    BillingWorkspacePaymentNotificationService,
    BillingSubscriptionActionsService,
    BillingAddonActionsService,
  ],
  exports: [
    BillingProviderService,
    BillingCheckoutService,
    BillingManageService,
    BillingAdminSyncService,
    BillingAdminWebhookReplayService,
    BillingWebhookEventsService,
    BillingWebhookAlertService,
    BillingInvoicesService,
    BillingProfileService,
    BillingSubscriptionActionsService,
    BillingAddonActionsService,
  ],
})
export class BillingModule {}
