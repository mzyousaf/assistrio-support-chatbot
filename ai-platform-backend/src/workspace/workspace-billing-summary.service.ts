import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { UsageLedger } from '../models/usage-ledger.schema';
import { WorkspaceAddon } from '../models/workspace-addon.schema';
import { WorkspaceCreditTopUp } from '../models/workspace-credit-top-up.schema';
import { WorkspaceBillingOrder } from '../models/workspace-billing-order.schema';
import { User, Workspace, WorkspaceMembership, WorkspaceSubscription } from '../models';
import { BillingWebhookEventsService } from '../billing/billing-webhook-events.service';
import { getServerLocalMonthlyBillingPeriod } from '../chat/chat-billing-period.util';
import { getPlanByKey } from '../entitlements/plan-catalog';
import { WORKSPACE_ADDON_CATALOG, isLegacyKbAddonKey } from '../entitlements/addon-catalog';
import { workspaceCustomerBotCountFilter } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceAiCreditsUsageService } from '../entitlements/workspace-ai-credits-usage.service';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceMemberLimitService } from '../entitlements/workspace-member-limit.service';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import { BillingProviderService } from '../billing/billing-provider.service';
import { BillingAiCreditsAutoTopUpService } from '../billing/billing-ai-credits-auto-topup.service';
import {
  readAiCreditsAutoTopUpPromptEnabled,
  readAutoTopUpThresholdCredits,
} from '../billing/billing-credit-auto-topup.util';
import { KnowledgeUsageService } from '../knowledge/knowledge-usage.service';
import type { BotForKnowledgeUsageLimit } from '../knowledge/knowledge-usage.util';
import type { WorkspaceBillingSummary } from './workspace-billing-summary.types';
import type {
  AdminWorkspaceBillingSummary,
  AdminWorkspaceBillingSupport,
} from './workspace-billing-summary.types';
import {
  buildPublicPlanCatalogSnapshot,
  buildTrainedKnowledgeUsageSummary,
  mapAiCreditsUsageToBillingSummary,
  mapBotKnowledgeUsageRow,
  mapBotUsageToBillingSummary,
  mapEntitlementsToBillingSummary,
  mapMemberUsageToBillingSummary,
  mapPlanSummary,
} from './workspace-billing-summary.util';
import {
  buildEnrichedAddonCatalog,
  mapAddonRowsForSummary,
  mapExtraBotAddonsForSummary,
  type WorkspaceAddonDbRow,
} from './workspace-billing-addon-summary.util';
import { toCustomerSafePaymentMethod } from '../billing/billing-payment-method.util';
import { formatInvoiceAmountFormatted } from '../billing/billing-invoice-format.util';
import { buildWorkspaceBillingSubscriptionSummary } from './workspace-billing-subscription-summary.util';

type WorkspaceCustomerBotLean = BotForKnowledgeUsageLimit & {
  _id: Types.ObjectId;
  name?: string;
};

@Injectable()
export class WorkspaceBillingSummaryService {
  constructor(
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly subscriptionsService: WorkspaceSubscriptionsService,
    private readonly billingProviderService: BillingProviderService,
    private readonly memberLimitService: WorkspaceMemberLimitService,
    private readonly botLimitService: WorkspaceBotLimitService,
    private readonly aiCreditsUsageService: WorkspaceAiCreditsUsageService,
    private readonly knowledgeUsageService: KnowledgeUsageService,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(WorkspaceMembership.name) private readonly membershipModel: Model<WorkspaceMembership>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(WorkspaceSubscription.name) private readonly subscriptionModel: Model<WorkspaceSubscription>,
    @InjectModel(UsageLedger.name) private readonly usageLedgerModel: Model<UsageLedger>,
    @InjectModel(WorkspaceAddon.name) private readonly addonModel: Model<WorkspaceAddon>,
    @InjectModel(WorkspaceCreditTopUp.name) private readonly topUpModel: Model<WorkspaceCreditTopUp>,
    @InjectModel(WorkspaceBillingOrder.name) private readonly billingOrderModel: Model<WorkspaceBillingOrder>,
    private readonly webhookEventsService: BillingWebhookEventsService,
    private readonly billingAiCreditsAutoTopUpService: BillingAiCreditsAutoTopUpService,
  ) {}

  async getSummary(workspaceId: string, now: Date = new Date()): Promise<WorkspaceBillingSummary> {
    await this.subscriptionsService.applyPendingScheduledPlanChanges(workspaceId, now);

    const [
      entitlements,
      subscription,
      memberUsage,
      botUsage,
      aiCreditsUsage,
      perBotKnowledge,
      addonDbRows,
      topUpRows,
    ] = await Promise.all([
      this.entitlementsService.resolveForWorkspace(workspaceId),
      this.subscriptionsService.findByWorkspaceId(workspaceId),
      this.memberLimitService.getWorkspaceMemberUsage(workspaceId, now),
      this.botLimitService.getWorkspaceBotUsage(workspaceId),
      this.aiCreditsUsageService.getWorkspaceAiCreditsUsage(workspaceId, now),
      this.loadTrainedKnowledgePerBot(workspaceId),
      this.loadAllAddonsForSummary(workspaceId),
      this.loadTopUpsForSummary(workspaceId),
    ]);

    const planDef = getPlanByKey(subscription?.planKey ?? entitlements.planKey);
    const period =
      subscription != null
        ? {
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : (() => {
            const billingPeriod = getServerLocalMonthlyBillingPeriod(now);
            return {
              currentPeriodStart: billingPeriod.billingPeriodStart,
              currentPeriodEnd: billingPeriod.billingPeriodEnd,
            };
          })();

    const checkoutConfigured = this.billingProviderService.isCheckoutConfigured();
    const usage = {
      bots: mapBotUsageToBillingSummary(botUsage),
      members: mapMemberUsageToBillingSummary(memberUsage),
      aiCredits: mapAiCreditsUsageToBillingSummary(aiCreditsUsage),
      trainedKnowledge: buildTrainedKnowledgeUsageSummary(perBotKnowledge),
    };
    const topUps = topUpRows.map((row) => ({
      creditsPurchased: row.creditsPurchased,
      creditsRemaining: row.creditsRemaining,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      amountFormatted: row.amountFormatted ?? null,
      receiptUrl: row.receiptUrl ?? null,
    }));

    return {
      workspaceId,
      plan: mapPlanSummary({
        entitlements,
        priceMonthly: planDef.priceMonthlyUsd,
        currentPeriodStart: period.currentPeriodStart,
        currentPeriodEnd: period.currentPeriodEnd,
      }),
      subscription: buildWorkspaceBillingSubscriptionSummary({
        subscription: subscription
          ? {
              planKey: subscription.planKey,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              provider: subscription.provider,
              providerSubscriptionId: subscription.providerSubscriptionId,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              paymentMethod: toCustomerSafePaymentMethod(subscription.paymentMethod ?? null),
              scheduledPlanChange: subscription.scheduledPlanChange
                ? {
                    fromPlanKey: subscription.scheduledPlanChange.fromPlanKey,
                    toPlanKey: subscription.scheduledPlanChange.toPlanKey,
                    fromBillingInterval: subscription.scheduledPlanChange.fromBillingInterval ?? null,
                    toBillingInterval: subscription.scheduledPlanChange.toBillingInterval ?? null,
                    effectiveAt:
                      subscription.scheduledPlanChange.effectiveAt instanceof Date
                        ? subscription.scheduledPlanChange.effectiveAt
                        : new Date(subscription.scheduledPlanChange.effectiveAt),
                    status: subscription.scheduledPlanChange.status,
                  }
                : null,
              billingInterval: subscription.billingInterval ?? 'monthly',
            }
          : null,
        currentPeriodStart: period.currentPeriodStart,
        currentPeriodEnd: period.currentPeriodEnd,
        checkoutConfigured,
        now,
      }),
      activeAddons: mapAddonRowsForSummary({ addonRows: addonDbRows, now, usage, topUps }).filter(
        (row) => !isLegacyKbAddonKey(row.addonKey),
      ),
      topUps,
      aiCreditsAutoTopUpPromptEnabled: readAiCreditsAutoTopUpPromptEnabled(subscription),
      autoTopUpThresholdCredits: readAutoTopUpThresholdCredits(subscription),
      topUpCheckoutAvailable: this.billingProviderService.isTopUpCheckoutAvailable('ai_credits_1000'),
      autoTopUp: await this.billingAiCreditsAutoTopUpService.buildSummary(workspaceId, subscription, now),
      entitlements: mapEntitlementsToBillingSummary(entitlements),
      usage,
      planCatalog: buildPublicPlanCatalogSnapshot((planKey, billingInterval = 'monthly') => {
        if (planKey === 'starter') {
          return this.billingProviderService.isPlanCheckoutAvailable('starter', billingInterval);
        }
        if (planKey === 'pro') {
          return this.billingProviderService.isPlanCheckoutAvailable('pro', billingInterval);
        }
        return false;
      }),
      addonCatalog: buildEnrichedAddonCatalog({
        checkoutAvailableForAddon: (addonKey, billingInterval = 'monthly') => {
          if (isLegacyKbAddonKey(addonKey)) return false;
          if (addonKey === 'ai_credits_1000') {
            return this.billingProviderService.isTopUpCheckoutAvailable('ai_credits_1000');
          }
          if (addonKey === 'extra_bot' || addonKey === 'remove_branding') {
            return this.billingProviderService.isAddonCheckoutAvailable(addonKey, billingInterval);
          }
          return false;
        },
        addonRows: addonDbRows,
        usage,
        topUps,
        creditAutoTopUpPromptEnabled: readAiCreditsAutoTopUpPromptEnabled(subscription),
        now,
      }),
      extraBotAddons: mapExtraBotAddonsForSummary({ addonRows: addonDbRows, now }),
    };
  }

  async getAdminSummary(workspaceId: string, now: Date = new Date()): Promise<AdminWorkspaceBillingSummary> {
    const summary = await this.getSummary(workspaceId, now);

    if (!Types.ObjectId.isValid(workspaceId)) {
      return {
        ...summary,
        admin: {
          workspaceName: 'Workspace',
          workspaceOwnerEmail: null,
          subscriptionId: null,
          subscriptionCreatedAt: null,
          subscriptionUpdatedAt: null,
          subscriptionStatus: 'free',
          providerSubscriptionId: null,
          providerCustomerId: null,
          activeAddons: summary.entitlements.activeAddons,
          topUpCreditsRemaining: summary.entitlements.topUpCreditsRemaining,
          usageLedgerCount: null,
        },
        support: this.emptyAdminSupport(summary),
      };
    }

    const workspaceObjectId = new Types.ObjectId(workspaceId);

    const [workspace, subscription, ownerMembership, usageLedgerCount, addons, topUps, webhookEvents] =
      await Promise.all([
      this.workspaceModel.findById(workspaceObjectId).select('name').lean().exec(),
      this.subscriptionModel
        .findOne({ workspaceId: workspaceObjectId })
        .select(
          '_id createdAt updatedAt status planKey provider providerCustomerId providerSubscriptionId providerVariantId cancelAtPeriodEnd currentPeriodStart currentPeriodEnd',
        )
        .lean()
        .exec(),
      this.membershipModel
        .findOne({ workspaceId: workspaceObjectId, role: 'owner' })
        .select('userId')
        .lean()
        .exec(),
      this.usageLedgerModel.countDocuments({ workspaceId: workspaceObjectId }),
      this.addonModel
        .find({ workspaceId: workspaceObjectId })
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
      this.topUpModel
        .find({ workspaceId: workspaceObjectId })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.webhookEventsService.findRecentForWorkspace(workspaceId, 20),
    ]);

    let workspaceOwnerEmail: string | null = null;
    if (ownerMembership?.userId) {
      const owner = await this.userModel
        .findById(ownerMembership.userId)
        .select('email')
        .lean()
        .exec();
      workspaceOwnerEmail = owner?.email?.trim() ? owner.email.trim() : null;
    }

    const subscriptionDoc = subscription as {
      _id?: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
      status?: string;
      planKey?: string;
      provider?: string | null;
      providerSubscriptionId?: string | null;
      providerCustomerId?: string | null;
      providerVariantId?: string | null;
      cancelAtPeriodEnd?: boolean;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
    } | null;

    const support = this.buildAdminSupport({
      summary,
      subscription: subscriptionDoc,
      addons: addons as Array<{
        addonKey: string;
        targetBotId?: Types.ObjectId | null;
        status: string;
        providerSubscriptionId?: string | null;
        providerOrderId?: string | null;
        currentPeriodStart?: Date | null;
        currentPeriodEnd?: Date | null;
      }>,
      topUps: topUps as Array<{
        creditsPurchased: number;
        creditsRemaining: number;
        expiresAt: Date;
        providerOrderId: string;
        createdAt?: Date;
      }>,
      webhookEvents: webhookEvents as Array<{
        _id?: Types.ObjectId;
        eventName: string;
        status: string;
        processingError?: string | null;
        processedAt?: Date | null;
        createdAt?: Date;
      }>,
    });

    return {
      ...summary,
      admin: {
        workspaceName: String((workspace as { name?: string } | null)?.name ?? '').trim() || 'Workspace',
        workspaceOwnerEmail,
        subscriptionId: subscriptionDoc?._id?.toString() ?? null,
        subscriptionCreatedAt: subscriptionDoc?.createdAt?.toISOString() ?? null,
        subscriptionUpdatedAt: subscriptionDoc?.updatedAt?.toISOString() ?? null,
        subscriptionStatus:
          (subscriptionDoc?.status as AdminWorkspaceBillingSummary['admin']['subscriptionStatus']) ??
          summary.plan.status,
        providerSubscriptionId: subscriptionDoc?.providerSubscriptionId?.trim() || null,
        providerCustomerId: subscriptionDoc?.providerCustomerId?.trim() || null,
        activeAddons: summary.entitlements.activeAddons,
        topUpCreditsRemaining: summary.entitlements.topUpCreditsRemaining,
        usageLedgerCount,
      },
      support,
    };
  }

  private emptyAdminSupport(
    summary: Awaited<ReturnType<WorkspaceBillingSummaryService['getSummary']>>,
  ): AdminWorkspaceBillingSupport {
    return {
      provider: {
        provider: null,
        providerCustomerId: null,
        providerSubscriptionId: null,
        providerVariantId: null,
        subscriptionStatus: summary.plan.status,
        cancelAtPeriodEnd: false,
        currentPeriodStart: summary.plan.currentPeriodStart,
        currentPeriodEnd: summary.plan.currentPeriodEnd,
      },
      addons: [],
      topUps: [],
      webhookEvents: [],
    };
  }

  private buildAdminSupport(input: {
    summary: Awaited<ReturnType<WorkspaceBillingSummaryService['getSummary']>>;
    subscription: {
      provider?: string | null;
      providerCustomerId?: string | null;
      providerSubscriptionId?: string | null;
      providerVariantId?: string | null;
      status?: string;
      cancelAtPeriodEnd?: boolean;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
    } | null;
    addons: Array<{
      addonKey: string;
      targetBotId?: Types.ObjectId | null;
      status: string;
      providerSubscriptionId?: string | null;
      providerOrderId?: string | null;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
    }>;
    topUps: Array<{
      creditsPurchased: number;
      creditsRemaining: number;
      expiresAt: Date;
      providerOrderId: string;
      createdAt?: Date;
    }>;
    webhookEvents: Array<{
      _id?: Types.ObjectId;
      eventName: string;
      status: string;
      processingError?: string | null;
      processedAt?: Date | null;
      createdAt?: Date;
    }>;
  }): AdminWorkspaceBillingSupport {
    const sub = input.subscription;
    return {
      provider: {
        provider: (sub?.provider as AdminWorkspaceBillingSupport['provider']['provider']) ?? null,
        providerCustomerId: sub?.providerCustomerId?.trim() || null,
        providerSubscriptionId: sub?.providerSubscriptionId?.trim() || null,
        providerVariantId: sub?.providerVariantId?.trim() || null,
        subscriptionStatus:
          (sub?.status as AdminWorkspaceBillingSupport['provider']['subscriptionStatus']) ??
          input.summary.plan.status,
        cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
        currentPeriodStart: (sub?.currentPeriodStart ?? new Date(input.summary.plan.currentPeriodStart)).toISOString(),
        currentPeriodEnd: (sub?.currentPeriodEnd ?? new Date(input.summary.plan.currentPeriodEnd)).toISOString(),
      },
      addons: input.addons.map((row) => ({
        addonKey: String(row.addonKey),
        targetBotId: row.targetBotId ? String(row.targetBotId) : null,
        status: String(row.status),
        providerSubscriptionId: row.providerSubscriptionId?.trim() || null,
        providerOrderId: row.providerOrderId?.trim() || null,
        currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      })),
      topUps: input.topUps.map((row) => ({
        creditsPurchased: row.creditsPurchased,
        creditsRemaining: row.creditsRemaining,
        expiresAt: row.expiresAt.toISOString(),
        providerOrderId: String(row.providerOrderId),
        createdAt: row.createdAt?.toISOString() ?? row.expiresAt.toISOString(),
      })),
      webhookEvents: input.webhookEvents.map((row) => ({
        id: String(row._id ?? ''),
        eventName: String(row.eventName),
        status: String(row.status),
        createdAt: row.createdAt?.toISOString() ?? '',
        processedAt: row.processedAt?.toISOString() ?? null,
        processingError: row.processingError?.trim() || null,
      })),
    };
  }

  private async loadAllAddonsForSummary(workspaceId: string): Promise<WorkspaceAddonDbRow[]> {
    if (!Types.ObjectId.isValid(workspaceId)) return [];

    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const [addons, bots] = await Promise.all([
      this.addonModel.find({ workspaceId: workspaceObjectId }).sort({ updatedAt: -1 }).lean().exec(),
      this.botModel
        .find(workspaceCustomerBotCountFilter(workspaceObjectId))
        .select('_id name')
        .lean()
        .exec(),
    ]);

    const botNameById = new Map(
      (bots as Array<{ _id: Types.ObjectId; name?: string }>).map((bot) => [
        String(bot._id),
        String(bot.name ?? '').trim() || 'Untitled agent',
      ]),
    );

    return (addons as Array<{
      _id: Types.ObjectId;
      addonKey: string;
      targetBotId?: Types.ObjectId | null;
      status: string;
      billingInterval?: string;
      providerSubscriptionId?: string | null;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      cancelAtPeriodEnd?: boolean;
      scheduledIntervalChange?: {
        fromBillingInterval: string;
        toBillingInterval: string;
        effectiveAt: Date;
        status: 'scheduled' | 'applied' | 'canceled';
      } | null;
    }>).map((row) => {
      const targetBotId = row.targetBotId ? String(row.targetBotId) : null;
      return {
        id: String(row._id),
        addonKey: String(row.addonKey),
        status: String(row.status),
        billingInterval: row.billingInterval === 'yearly' ? 'yearly' : 'monthly',
        targetBotId,
        targetBotName: targetBotId ? botNameById.get(targetBotId) ?? null : null,
        providerSubscriptionId: row.providerSubscriptionId?.trim() || null,
        currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
        scheduledIntervalChange: row.scheduledIntervalChange
          ? {
              fromBillingInterval:
                row.scheduledIntervalChange.fromBillingInterval === 'yearly' ? 'yearly' : 'monthly',
              toBillingInterval:
                row.scheduledIntervalChange.toBillingInterval === 'yearly' ? 'yearly' : 'monthly',
              effectiveAt:
                row.scheduledIntervalChange.effectiveAt instanceof Date
                  ? row.scheduledIntervalChange.effectiveAt.toISOString()
                  : String(row.scheduledIntervalChange.effectiveAt),
              status: row.scheduledIntervalChange.status,
            }
          : null,
      };
    });
  }

  private async loadTopUpsForSummary(workspaceId: string) {
    if (!Types.ObjectId.isValid(workspaceId)) return [];

    const topUps = await this.topUpModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const topUpPriceUsd =
      WORKSPACE_ADDON_CATALOG.find((item) => item.key === 'ai_credits_1000')?.priceUsd ?? 30;

    const orderIds = (topUps as Array<{ providerOrderId?: string }>)
      .map((row) => String(row.providerOrderId ?? '').trim())
      .filter(Boolean);

    const ordersByProviderOrderId = new Map<
      string,
      { amountCents: number; currency: string; receiptUrl: string | null; invoiceUrl: string | null }
    >();

    if (orderIds.length > 0) {
      const orders = await this.billingOrderModel
        .find({ providerOrderId: { $in: orderIds } })
        .select('providerOrderId amountCents currency receiptUrl invoiceUrl')
        .lean()
        .exec();

      for (const order of orders as Array<{
        providerOrderId: string;
        amountCents: number;
        currency: string;
        receiptUrl?: string | null;
        invoiceUrl?: string | null;
      }>) {
        ordersByProviderOrderId.set(String(order.providerOrderId), {
          amountCents: order.amountCents,
          currency: order.currency || 'USD',
          receiptUrl: order.receiptUrl?.trim() || null,
          invoiceUrl: order.invoiceUrl?.trim() || null,
        });
      }
    }

    return (topUps as Array<{
      creditsPurchased: number;
      creditsRemaining: number;
      expiresAt: Date;
      createdAt?: Date;
      providerOrderId: string;
    }>).map((row) => {
      const order = ordersByProviderOrderId.get(String(row.providerOrderId));
      const amountFormatted = order
        ? formatInvoiceAmountFormatted(order.amountCents, order.currency)
        : `$${topUpPriceUsd.toFixed(2)}`;

      return {
        creditsPurchased: row.creditsPurchased,
        creditsRemaining: row.creditsRemaining,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt?.toISOString() ?? row.expiresAt.toISOString(),
        amountFormatted,
        receiptUrl: order?.receiptUrl ?? order?.invoiceUrl ?? null,
      };
    });
  }

  private async loadTrainedKnowledgePerBot(workspaceId: string) {
    if (!Types.ObjectId.isValid(workspaceId)) return [];

    const bots = (await this.botModel
      .find(workspaceCustomerBotCountFilter(new Types.ObjectId(workspaceId)))
      .select('_id name workspaceId botConfig')
      .lean()
      .exec()) as WorkspaceCustomerBotLean[];

    const rows = await Promise.all(
      bots.map(async (bot) => {
        const usage = await this.knowledgeUsageService.getActiveBotKnowledgeUsage(bot._id, bot);
        return mapBotKnowledgeUsageRow({
          botId: String(bot._id),
          botName: String(bot.name ?? '').trim() || 'Untitled agent',
          usage,
        });
      }),
    );

    rows.sort((a, b) => a.botName.localeCompare(b.botName, undefined, { sensitivity: 'base' }));
    return rows;
  }
}
