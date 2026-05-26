import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { UsageLedger } from '../models/usage-ledger.schema';
import { User, Workspace, WorkspaceMembership, WorkspaceSubscription } from '../models';
import { getServerLocalMonthlyBillingPeriod } from '../chat/chat-billing-period.util';
import { getPlanByKey } from '../entitlements/plan-catalog';
import { workspaceCustomerBotCountFilter } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceAiCreditsUsageService } from '../entitlements/workspace-ai-credits-usage.service';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceMemberLimitService } from '../entitlements/workspace-member-limit.service';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import { KnowledgeUsageService } from '../knowledge/knowledge-usage.service';
import type { BotForKnowledgeUsageLimit } from '../knowledge/knowledge-usage.util';
import type { WorkspaceBillingSummary } from './workspace-billing-summary.types';
import type { AdminWorkspaceBillingSummary } from './workspace-billing-summary.types';
import {
  buildPublicAddonCatalogSnapshot,
  buildPublicPlanCatalogSnapshot,
  buildTrainedKnowledgeUsageSummary,
  mapAiCreditsUsageToBillingSummary,
  mapBotKnowledgeUsageRow,
  mapBotUsageToBillingSummary,
  mapEntitlementsToBillingSummary,
  mapMemberUsageToBillingSummary,
  mapPlanSummary,
} from './workspace-billing-summary.util';

type WorkspaceCustomerBotLean = BotForKnowledgeUsageLimit & {
  _id: Types.ObjectId;
  name?: string;
};

@Injectable()
export class WorkspaceBillingSummaryService {
  constructor(
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly subscriptionsService: WorkspaceSubscriptionsService,
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
  ) {}

  async getSummary(workspaceId: string, now: Date = new Date()): Promise<WorkspaceBillingSummary> {
    const [
      entitlements,
      subscription,
      memberUsage,
      botUsage,
      aiCreditsUsage,
      perBotKnowledge,
    ] = await Promise.all([
      this.entitlementsService.resolveForWorkspace(workspaceId),
      this.subscriptionsService.findByWorkspaceId(workspaceId),
      this.memberLimitService.getWorkspaceMemberUsage(workspaceId, now),
      this.botLimitService.getWorkspaceBotUsage(workspaceId),
      this.aiCreditsUsageService.getWorkspaceAiCreditsUsage(workspaceId, now),
      this.loadTrainedKnowledgePerBot(workspaceId),
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

    return {
      workspaceId,
      plan: mapPlanSummary({
        entitlements,
        priceMonthly: planDef.priceMonthlyUsd,
        currentPeriodStart: period.currentPeriodStart,
        currentPeriodEnd: period.currentPeriodEnd,
      }),
      entitlements: mapEntitlementsToBillingSummary(entitlements),
      usage: {
        bots: mapBotUsageToBillingSummary(botUsage),
        members: mapMemberUsageToBillingSummary(memberUsage),
        aiCredits: mapAiCreditsUsageToBillingSummary(aiCreditsUsage),
        trainedKnowledge: buildTrainedKnowledgeUsageSummary(perBotKnowledge),
      },
      planCatalog: buildPublicPlanCatalogSnapshot(),
      addonCatalog: buildPublicAddonCatalogSnapshot(),
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
          activeAddons: summary.entitlements.activeAddons,
          topUpCreditsRemaining: summary.entitlements.topUpCreditsRemaining,
          usageLedgerCount: null,
        },
      };
    }

    const workspaceObjectId = new Types.ObjectId(workspaceId);

    const [workspace, subscription, ownerMembership, usageLedgerCount] = await Promise.all([
      this.workspaceModel.findById(workspaceObjectId).select('name').lean().exec(),
      this.subscriptionModel
        .findOne({ workspaceId: workspaceObjectId })
        .select('_id createdAt updatedAt')
        .lean()
        .exec(),
      this.membershipModel
        .findOne({ workspaceId: workspaceObjectId, role: 'owner' })
        .select('userId')
        .lean()
        .exec(),
      this.usageLedgerModel.countDocuments({ workspaceId: workspaceObjectId }),
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
    } | null;

    return {
      ...summary,
      admin: {
        workspaceName: String((workspace as { name?: string } | null)?.name ?? '').trim() || 'Workspace',
        workspaceOwnerEmail,
        subscriptionId: subscriptionDoc?._id?.toString() ?? null,
        subscriptionCreatedAt: subscriptionDoc?.createdAt?.toISOString() ?? null,
        subscriptionUpdatedAt: subscriptionDoc?.updatedAt?.toISOString() ?? null,
        activeAddons: summary.entitlements.activeAddons,
        topUpCreditsRemaining: summary.entitlements.topUpCreditsRemaining,
        usageLedgerCount,
      },
    };
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
