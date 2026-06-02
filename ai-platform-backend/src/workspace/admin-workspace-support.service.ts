import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { Conversation } from '../models/conversation.schema';
import { Workspace } from '../models/workspace.schema';
import { botNotDeletedClause } from '../bots/bot-not-deleted.util';
import { computeOwnerShareLinkStatus } from '../bots/share-preview-owner-status.util';
import { workspaceCustomerBotCountFilter } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceInviteService } from '../workspaces/workspace-invite.service';
import { WorkspaceBillingSummaryService } from './workspace-billing-summary.service';
import { WorkspaceUsageAnalyticsService } from './workspace-usage-analytics.service';
import type {
  AdminWorkspaceSupportConversation,
  AdminWorkspaceSupportSummary,
  AdminWorkspaceSupportUsageAnalytics,
} from './admin-workspace-support.types';

@Injectable()
export class AdminWorkspaceSupportService {
  constructor(
    private readonly billingSummaryService: WorkspaceBillingSummaryService,
    private readonly botLimitService: WorkspaceBotLimitService,
    private readonly workspacesService: WorkspacesService,
    private readonly inviteService: WorkspaceInviteService,
    private readonly usageAnalyticsService: WorkspaceUsageAnalyticsService,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
  ) {}

  async getSupportSummary(workspaceId: string, now: Date = new Date()): Promise<AdminWorkspaceSupportSummary> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    const workspaceOid = new Types.ObjectId(workspaceId);
    const billing = await this.billingSummaryService.getAdminSummary(workspaceId, now);

    const [workspaceDoc, lockedBotIds, members, invites, bots] = await Promise.all([
      this.workspaceModel.findById(workspaceOid).select('name onboardingStatus createdAt').lean().exec(),
      this.botLimitService.resolveOverLimitLockedBotIdSet(workspaceId),
      this.workspacesService.listWorkspaceMembers(workspaceId),
      this.inviteService.listInvitesForWorkspace(workspaceId),
      this.botModel
        .find({ $and: [botNotDeletedClause(), workspaceCustomerBotCountFilter(workspaceOid)] })
        .select('_id name status visibility createdAt updatedAt shareChat')
        .sort({ name: 1 })
        .lean()
        .exec(),
    ]);

    if (!workspaceDoc) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    const creditsByBot = new Map(
      (billing.usage.aiCredits.byBot ?? []).map((row) => [row.botId, row.creditsUsed ?? 0]),
    );
    const kbByBot = new Map(
      (billing.usage.trainedKnowledge.perBot ?? []).map((row) => [row.botId, row]),
    );
    const botNameById = new Map(
      (bots as Array<{ _id: Types.ObjectId; name?: string }>).map((bot) => [
        String(bot._id),
        String(bot.name ?? '').trim() || 'Untitled agent',
      ]),
    );

    const [convCounts, recentConversations] = await Promise.all([
      this.countConversationsByBot(workspaceOid),
      this.loadRecentConversations(workspaceOid),
    ]);

    const agents = (bots as Array<Record<string, unknown>>).map((bot) => {
      const id = String(bot._id);
      const shareChat = (bot.shareChat ?? {}) as Record<string, unknown>;
      const shareStatus = computeOwnerShareLinkStatus(shareChat);
      const kb = kbByBot.get(id);
      const isOverLimitLocked = lockedBotIds.has(id);
      return {
        id,
        name: botNameById.get(id) ?? 'Untitled agent',
        status: String(bot.status ?? 'draft'),
        visibility: typeof bot.visibility === 'string' ? bot.visibility : null,
        createdAt: bot.createdAt instanceof Date ? bot.createdAt.toISOString() : null,
        updatedAt: bot.updatedAt instanceof Date ? bot.updatedAt.toISOString() : null,
        isOverLimitLocked,
        lockedReason: isOverLimitLocked ? 'workspace_bot_limit_exceeded' : null,
        sharePreviewEnabled: shareChat.enabled === true,
        sharePreviewStatus: shareStatus,
        kbUsedMb: kb?.usedMb ?? null,
        kbMaxMb: kb?.maxMb ?? null,
        conversationCount: convCounts.get(id) ?? null,
        creditsUsedThisPeriod: creditsByBot.get(id) ?? 0,
      };
    });

    const ownerMember = members.find((m) => m.role === 'owner') ?? members[0] ?? null;
    const owner: AdminWorkspaceSupportSummary['owner'] = ownerMember
      ? {
          userId: ownerMember.userId,
          name: ownerMember.displayName?.trim() || ownerMember.email,
          email: ownerMember.email?.trim() || billing.admin.workspaceOwnerEmail,
        }
      : billing.admin.workspaceOwnerEmail
        ? {
            userId: '',
            name: billing.admin.workspaceOwnerEmail,
            email: billing.admin.workspaceOwnerEmail,
          }
        : null;

    const inactiveMembersCount = members.filter((m) => m.membershipStatus === 'inactive_over_limit').length;
    const webhookEvents = billing.support?.webhookEvents ?? [];
    const failedCount = webhookEvents.filter((e) => e.status === 'failed').length;

    return {
      workspace: {
        id: workspaceId,
        name: String((workspaceDoc as { name?: string }).name ?? '').trim() || billing.admin.workspaceName,
        onboardingStatus:
          typeof (workspaceDoc as { onboardingStatus?: string }).onboardingStatus === 'string'
            ? (workspaceDoc as { onboardingStatus?: string }).onboardingStatus!
            : null,
        createdAt:
          (workspaceDoc as { createdAt?: Date }).createdAt instanceof Date
            ? (workspaceDoc as { createdAt?: Date }).createdAt!.toISOString()
            : null,
      },
      owner,
      subscription: billing.subscription,
      entitlements: billing.entitlements,
      usage: {
        ...billing.usage,
        lockedAgentsCount: agents.filter((a) => a.isOverLimitLocked).length,
        inactiveMembersCount,
      },
      agents,
      members: members.map((m) => ({
        userId: m.userId,
        email: m.email,
        name: m.displayName,
        role: m.role,
        membershipStatus: m.membershipStatus,
        joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : null,
      })),
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        createdAt:
          inv.createdAt instanceof Date
            ? inv.createdAt.toISOString()
            : typeof inv.createdAt === 'string'
              ? inv.createdAt
              : null,
        expiresAt:
          inv.expiresAt instanceof Date
            ? inv.expiresAt.toISOString()
            : typeof inv.expiresAt === 'string'
              ? inv.expiresAt
              : null,
      })),
      knowledge: (billing.usage.trainedKnowledge.perBot ?? []).map((row) => ({
        botId: row.botId,
        botName: row.botName,
        usedMb: row.usedMb,
        maxMb: row.maxMb,
        percentUsed: row.percentUsed,
      })),
      conversations: recentConversations,
      billing,
      webhookHealth: {
        failedCount,
        recentFailureCount: failedCount,
        lastProcessedAt:
          webhookEvents.find((e) => e.processedAt)?.processedAt ??
          webhookEvents.find((e) => e.status === 'processed')?.processedAt ??
          null,
      },
      recentEvents: webhookEvents,
    };
  }

  async getUsageAnalytics(
    workspaceId: string,
    query: { startDate?: string; endDate?: string; botIds?: string },
    now: Date = new Date(),
  ): Promise<AdminWorkspaceSupportUsageAnalytics> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }
    return this.usageAnalyticsService.getAnalytics(workspaceId, query, now);
  }

  private async countConversationsByBot(workspaceOid: Types.ObjectId): Promise<Map<string, number>> {
    const rows = await this.conversationModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { workspaceId: workspaceOid } },
        { $group: { _id: '$botId', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((row) => [String(row._id), row.count ?? 0]));
  }

  private async loadRecentConversations(workspaceOid: Types.ObjectId): Promise<AdminWorkspaceSupportConversation[]> {
    const rows = await this.conversationModel
      .find({ workspaceId: workspaceOid })
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .limit(25)
      .select(
        'botId startedFrom totalMessages totalCreditsUsed lastActivityAt hasLead location.countryCode deviceInfo.deviceType',
      )
      .lean()
      .exec();

    const botIdsNeeded = [...new Set(rows.map((r) => String((r as { botId?: Types.ObjectId }).botId ?? '')))].filter(
      Boolean,
    );
    const bots = botIdsNeeded.length
      ? await this.botModel
          .find({ _id: { $in: botIdsNeeded.map((id) => new Types.ObjectId(id)) } })
          .select('name')
          .lean()
          .exec()
      : [];
    const botNames = new Map(
      (bots as Array<{ _id: Types.ObjectId; name?: string }>).map((b) => [
        String(b._id),
        String(b.name ?? '').trim() || 'Untitled agent',
      ]),
    );

    return (rows as Array<Record<string, unknown>>).map((row) => {
      const botId = String(row.botId ?? '');
      const location = (row.location ?? {}) as { countryCode?: string };
      const deviceInfo = (row.deviceInfo ?? {}) as { deviceType?: string };
      return {
        id: String(row._id ?? ''),
        botId,
        botName: botNames.get(botId) ?? 'Untitled agent',
        startedFrom: typeof row.startedFrom === 'string' ? row.startedFrom : null,
        messageCount: typeof row.totalMessages === 'number' ? row.totalMessages : null,
        creditsUsed: typeof row.totalCreditsUsed === 'number' ? row.totalCreditsUsed : null,
        lastActivityAt:
          row.lastActivityAt instanceof Date
            ? row.lastActivityAt.toISOString()
            : typeof row.lastActivityAt === 'string'
              ? row.lastActivityAt
              : null,
        leadCaptured: row.hasLead === true,
        country: typeof location.countryCode === 'string' ? location.countryCode : null,
        device: typeof deviceInfo.deviceType === 'string' ? deviceInfo.deviceType : null,
      };
    });
  }
}
