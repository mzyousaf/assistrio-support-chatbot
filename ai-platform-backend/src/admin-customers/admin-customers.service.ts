import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, Conversation, User, Workspace, WorkspaceMembership } from '../models';
import { botNotDeletedClause } from '../bots/bot-not-deleted.util';
import { WorkspaceAiCreditsUsageService } from '../entitlements/workspace-ai-credits-usage.service';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceMemberLimitService } from '../entitlements/workspace-member-limit.service';
import {
  accessibleBotsMatchForCustomer,
  customerDisplayName,
  escapeRegexLiteral,
  isoOrNull,
  parsePaginationQuery,
} from './admin-customers.util';

export type AdminCustomerWorkspace = {
  id: string;
  name: string;
  role?: string;
  memberCount?: number;
  botCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  planKey?: string;
  planName?: string;
  subscriptionStatus?: string;
  monthlyAiCredits?: number;
  aiCreditsUsedThisPeriod?: number;
  botLimit?: number;
  memberLimit?: number;
  currentBots?: number;
  currentMembers?: number;
};

export type AdminCustomerRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActiveAt?: string | null;
  workspaceCount: number;
  botCount: number;
  publishedBotCount: number;
  draftBotCount: number;
};

type BotCountBucket = { total: number; published: number; draft: number };

@Injectable()
export class AdminCustomersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(WorkspaceMembership.name) private readonly membershipModel: Model<WorkspaceMembership>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly botLimitService: WorkspaceBotLimitService,
    private readonly memberLimitService: WorkspaceMemberLimitService,
    private readonly aiCreditsUsageService: WorkspaceAiCreditsUsageService,
  ) {}

  private assertCustomerObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({ error: 'Customer not found' });
    }
    return new Types.ObjectId(id);
  }

  private async findCustomerUser(customerId: Types.ObjectId) {
    const doc = await this.userModel.findOne({ _id: customerId, role: 'customer' }).lean();
    if (!doc) {
      throw new NotFoundException({ error: 'Customer not found' });
    }
    return doc as {
      _id: Types.ObjectId;
      email?: string;
      firstName?: string;
      lastName?: string;
      picture?: string;
      createdAt?: Date;
    };
  }

  private async workspaceIdsForUser(userId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const rows = await this.membershipModel.find({ userId }).select('workspaceId').lean();
    return (rows as { workspaceId: Types.ObjectId }[])
      .map((r) => r.workspaceId)
      .filter((id) => id != null);
  }

  private async botCountsForUsers(
    userIds: Types.ObjectId[],
    membershipsByUser: Map<string, Types.ObjectId[]>,
  ): Promise<Map<string, BotCountBucket>> {
    const out = new Map<string, BotCountBucket>();
    for (const uid of userIds) {
      out.set(String(uid), { total: 0, published: 0, draft: 0 });
    }
    if (userIds.length === 0) return out;

    await Promise.all(
      userIds.map(async (uid) => {
        const wsIds = membershipsByUser.get(String(uid)) ?? [];
        const match = {
          $and: [botNotDeletedClause(), accessibleBotsMatchForCustomer(uid, wsIds)],
        };
        const [total, published, draft] = await Promise.all([
          this.botModel.countDocuments(match).exec(),
          this.botModel.countDocuments({ ...match, status: 'published' }).exec(),
          this.botModel.countDocuments({ ...match, status: 'draft' }).exec(),
        ]);
        out.set(String(uid), { total, published, draft });
      }),
    );

    return out;
  }

  private async workspaceCountsForUsers(userIds: Types.ObjectId[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!userIds.length) return out;
    const rows = await this.membershipModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ])
      .exec();
    for (const r of rows) {
      out.set(String(r._id), r.count);
    }
    return out;
  }

  private async lastActiveAtForUser(userId: Types.ObjectId, workspaceIds: Types.ObjectId[]): Promise<string | null> {
    const botMatch = {
      $and: [botNotDeletedClause(), accessibleBotsMatchForCustomer(userId, workspaceIds)],
    };
    const botIds = await this.botModel.find(botMatch).select('_id').lean();
    const ids = (botIds as { _id: Types.ObjectId }[]).map((b) => b._id);
    if (!ids.length) return null;
    const row = await this.conversationModel
      .findOne({ botId: { $in: ids } })
      .sort({ lastActivityAt: -1 })
      .select('lastActivityAt')
      .lean();
    const la = (row as { lastActivityAt?: Date } | null)?.lastActivityAt;
    return isoOrNull(la);
  }

  private mapUserToCustomerRow(
    doc: {
      _id: Types.ObjectId;
      email?: string;
      firstName?: string;
      lastName?: string;
      picture?: string;
      createdAt?: Date;
    },
    workspaceCount: number,
    botCounts: BotCountBucket,
    lastActiveAt: string | null,
  ): AdminCustomerRow {
    return {
      id: String(doc._id),
      name: customerDisplayName(doc),
      email: String(doc.email ?? '').trim(),
      avatarUrl: doc.picture?.trim() ? doc.picture.trim() : null,
      createdAt: isoOrNull(doc.createdAt),
      updatedAt: null,
      lastActiveAt,
      workspaceCount,
      botCount: botCounts.total,
      publishedBotCount: botCounts.published,
      draftBotCount: botCounts.draft,
    };
  }

  async listCustomers(params: { q?: string; page?: string; limit?: string }) {
    const { page, limit, skip } = parsePaginationQuery(params.page, params.limit);
    const filter: Record<string, unknown> = { role: 'customer' };
    const q = String(params.q ?? '').trim();
    if (q) {
      const re = new RegExp(escapeRegexLiteral(q), 'i');
      filter.$or = [{ email: re }, { firstName: re }, { lastName: re }];
    }

    const [total, docs] = await Promise.all([
      this.userModel.countDocuments(filter).exec(),
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const users = docs as Array<{
      _id: Types.ObjectId;
      email?: string;
      firstName?: string;
      lastName?: string;
      picture?: string;
      createdAt?: Date;
    }>;
    const userIds = users.map((u) => u._id);

    const membershipRows = userIds.length
      ? await this.membershipModel
          .find({ userId: { $in: userIds } })
          .select('userId workspaceId')
          .lean()
          .exec()
      : [];

    const membershipsByUser = new Map<string, Types.ObjectId[]>();
    for (const uid of userIds) {
      membershipsByUser.set(String(uid), []);
    }
    for (const row of membershipRows as { userId: Types.ObjectId; workspaceId: Types.ObjectId }[]) {
      const key = String(row.userId);
      const list = membershipsByUser.get(key) ?? [];
      list.push(row.workspaceId);
      membershipsByUser.set(key, list);
    }

    const [workspaceCounts, botCounts] = await Promise.all([
      this.workspaceCountsForUsers(userIds),
      this.botCountsForUsers(userIds, membershipsByUser),
    ]);

    const lastActivePairs = await Promise.all(
      users.map(async (u) => ({
        id: String(u._id),
        at: await this.lastActiveAtForUser(u._id, membershipsByUser.get(String(u._id)) ?? []),
      })),
    );
    const lastActiveByUser = new Map(lastActivePairs.map((p) => [p.id, p.at]));

    const customers = users.map((u) =>
      this.mapUserToCustomerRow(
        u,
        workspaceCounts.get(String(u._id)) ?? 0,
        botCounts.get(String(u._id)) ?? { total: 0, published: 0, draft: 0 },
        lastActiveByUser.get(String(u._id)) ?? null,
      ),
    );

    return {
      ok: true as const,
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getCustomer(customerIdRaw: string) {
    const customerId = this.assertCustomerObjectId(customerIdRaw);
    const doc = await this.findCustomerUser(customerId);
    const workspaceIds = await this.workspaceIdsForUser(customerId);
    const wsCount = workspaceIds.length;
    const botCounts =
      (await this.botCountsForUsers([customerId], new Map([[String(customerId), workspaceIds]]))).get(
        String(customerId),
      ) ?? { total: 0, published: 0, draft: 0 };
    const lastActiveAt = await this.lastActiveAtForUser(customerId, workspaceIds);

    return {
      ok: true as const,
      customer: this.mapUserToCustomerRow(doc, wsCount, botCounts, lastActiveAt),
    };
  }

  async getCustomerWorkspaces(customerIdRaw: string) {
    const customerId = this.assertCustomerObjectId(customerIdRaw);
    await this.findCustomerUser(customerId);

    const memberships = await this.membershipModel
      .find({ userId: customerId })
      .lean()
      .exec();

    if (!memberships.length) {
      return { ok: true as const, workspaces: [] };
    }

    const wsIds = (memberships as { workspaceId: Types.ObjectId; role?: string }[]).map((m) => m.workspaceId);
    const wsDocs = await this.workspaceModel.find({ _id: { $in: wsIds } }).lean().exec();
    const wsById = new Map(
      (wsDocs as { _id: Types.ObjectId; name?: string; createdAt?: Date }[]).map((w) => [String(w._id), w]),
    );

    const memberCounts = await this.membershipModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { workspaceId: { $in: wsIds } } },
        { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
      ])
      .exec();
    const memberCountByWs = new Map(memberCounts.map((r) => [String(r._id), r.count]));

    const botCountsByWs = await this.botModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            $and: [botNotDeletedClause(), { workspaceId: { $in: wsIds } }],
          },
        },
        { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
      ])
      .exec();
    const botCountByWs = new Map(botCountsByWs.map((r) => [String(r._id), r.count]));

    const billingByWs = await this.loadWorkspaceBillingSnapshots(
      (memberships as { workspaceId: Types.ObjectId }[]).map((m) => String(m.workspaceId)),
    );

    const workspaces: AdminCustomerWorkspace[] = (memberships as { workspaceId: Types.ObjectId; role?: string }[]).map(
      (m) => {
      const id = String(m.workspaceId);
      const ws = wsById.get(id);
      const billing = billingByWs.get(id);
      return {
        id,
        name: String(ws?.name ?? '').trim() || 'Workspace',
        role: m.role ?? undefined,
        memberCount: memberCountByWs.get(id) ?? 0,
        botCount: botCountByWs.get(id) ?? 0,
        createdAt: isoOrNull(ws?.createdAt),
        updatedAt: null,
        planKey: billing?.planKey,
        planName: billing?.planName,
        subscriptionStatus: billing?.subscriptionStatus,
        monthlyAiCredits: billing?.monthlyAiCredits,
        aiCreditsUsedThisPeriod: billing?.aiCreditsUsedThisPeriod,
        botLimit: billing?.botLimit,
        memberLimit: billing?.memberLimit,
        currentBots: billing?.currentBots,
        currentMembers: billing?.currentMembers,
      };
    },
    );

    workspaces.sort((a, b) => a.name.localeCompare(b.name));

    return { ok: true as const, workspaces };
  }

  async getCustomerBots(customerIdRaw: string) {
    const customerId = this.assertCustomerObjectId(customerIdRaw);
    await this.findCustomerUser(customerId);
    const workspaceIds = await this.workspaceIdsForUser(customerId);

    const match = {
      $and: [botNotDeletedClause(), accessibleBotsMatchForCustomer(customerId, workspaceIds)],
    };

    const botDocs = await this.botModel
      .find(match)
      .sort({ createdAt: -1 })
      .select('name description status visibility workspaceId createdAt')
      .lean()
      .exec();

    const wsIdSet = new Set<string>();
    for (const b of botDocs as { workspaceId?: Types.ObjectId }[]) {
      if (b.workspaceId) wsIdSet.add(String(b.workspaceId));
    }
    const wsDocs =
      wsIdSet.size > 0
        ? await this.workspaceModel
            .find({ _id: { $in: [...wsIdSet].map((id) => new Types.ObjectId(id)) } })
            .select('name')
            .lean()
            .exec()
        : [];
    const wsNameById = new Map(
      (wsDocs as { _id: Types.ObjectId; name?: string }[]).map((w) => [
        String(w._id),
        String(w.name ?? '').trim() || 'Workspace',
      ]),
    );

    const bots = (botDocs as Array<Record<string, unknown>>).map((b) => {
      const id = String(b._id);
      const wsId = b.workspaceId != null ? String(b.workspaceId) : null;
      const status = b.status === 'published' ? 'published' : 'draft';
      const visibility =
        b.visibility === 'private' ? 'private' : b.visibility === 'public' ? 'public' : undefined;
      return {
        id,
        name: String(b.name ?? '').trim() || 'Untitled',
        description:
          typeof b.description === 'string' && b.description.trim() ? b.description.trim() : null,
        status: status as 'draft' | 'published',
        visibility,
        workspaceId: wsId,
        workspaceName: wsId ? wsNameById.get(wsId) ?? null : null,
        createdAt: isoOrNull(b.createdAt),
        updatedAt: null,
      };
    });

    return { ok: true as const, bots };
  }

  private async loadWorkspaceBillingSnapshots(workspaceIds: string[]) {
    const out = new Map<
      string,
      {
        planKey: string;
        planName: string;
        subscriptionStatus: string;
        monthlyAiCredits: number;
        aiCreditsUsedThisPeriod: number;
        botLimit: number;
        memberLimit: number;
        currentBots: number;
        currentMembers: number;
      }
    >();

    await Promise.all(
      workspaceIds.map(async (workspaceId) => {
        const [entitlements, botUsage, memberUsage, aiCreditsUsage] = await Promise.all([
          this.entitlementsService.resolveForWorkspace(workspaceId),
          this.botLimitService.getWorkspaceBotUsage(workspaceId),
          this.memberLimitService.getWorkspaceMemberUsage(workspaceId),
          this.aiCreditsUsageService.getWorkspaceAiCreditsUsage(workspaceId),
        ]);

        out.set(workspaceId, {
          planKey: entitlements.planKey,
          planName: entitlements.planName,
          subscriptionStatus: entitlements.subscriptionStatus,
          monthlyAiCredits: entitlements.monthlyAiCredits,
          aiCreditsUsedThisPeriod: aiCreditsUsage.monthlyCreditsUsed,
          botLimit: entitlements.botLimit,
          memberLimit: entitlements.memberLimit,
          currentBots: botUsage.current,
          currentMembers: memberUsage.current,
        });
      }),
    );

    return out;
  }
}
