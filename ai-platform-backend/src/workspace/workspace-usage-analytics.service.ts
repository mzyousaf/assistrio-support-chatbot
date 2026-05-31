import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { UsageLedger } from '../models/usage-ledger.schema';
import { workspaceCustomerBotCountFilter } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { KnowledgeUsageService } from '../knowledge/knowledge-usage.service';
import { mapBotKnowledgeUsageRow } from './workspace-billing-summary.util';
import type {
  WorkspaceAiCreditsByAgentRow,
  WorkspaceTrainedKnowledgeByAgentRow,
  WorkspaceUsageAnalyticsResponse,
  WorkspaceUsageTrendDay,
} from './workspace-usage-analytics.types';
import {
  allocateCreditsToPools,
  billingPeriodKey,
  clampUsageAnalyticsStartDate,
  enumerateUtcDaysInclusive,
  parseWorkspaceUsageAnalyticsQuery,
  utcDayBounds,
  utcYmdFromDate,
} from './workspace-usage-analytics.util';

type WorkspaceCustomerBotLean = {
  _id: Types.ObjectId;
  name?: string;
  botConfig?: Record<string, unknown>;
};

type UsageLedgerLean = {
  botId: Types.ObjectId;
  creditsUsed?: number;
  chargedAt?: Date;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
  messageId?: Types.ObjectId;
};

@Injectable()
export class WorkspaceUsageAnalyticsService {
  constructor(
    @InjectModel(UsageLedger.name) private readonly usageLedgerModel: Model<UsageLedger>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly knowledgeUsageService: KnowledgeUsageService,
  ) {}

  async getAnalytics(
    workspaceId: string,
    queryIn: { startDate?: string; endDate?: string; botIds?: string },
    now: Date = new Date(),
  ): Promise<WorkspaceUsageAnalyticsResponse> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    const parsed = parseWorkspaceUsageAnalyticsQuery(queryIn);
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const startDate = clampUsageAnalyticsStartDate(
      parsed.startDate,
      parsed.endDate,
      entitlements.analyticsHistoryDays,
      now,
    );
    const endDate = parsed.endDate;

    const bounds = utcDayBounds(startDate, endDate);
    if (!bounds) {
      throw new BadRequestException({ error: 'Invalid date range.' });
    }

    const workspaceOid = new Types.ObjectId(workspaceId);
    const workspaceBots = (await this.botModel
      .find(workspaceCustomerBotCountFilter(workspaceOid))
      .select('_id name botConfig')
      .lean()
      .exec()) as WorkspaceCustomerBotLean[];

    const workspaceBotIds = new Set(workspaceBots.map((bot) => String(bot._id)));
    const botIds = parsed.botIds.filter((id) => workspaceBotIds.has(id));
    if (parsed.botIds.length > 0 && botIds.length === 0) {
      return this.emptyResponse(startDate, endDate);
    }

    const botNameById = new Map(
      workspaceBots.map((bot) => [String(bot._id), String(bot.name ?? '').trim() || 'Untitled agent']),
    );

    const ledgerMatch: Record<string, unknown> = {
      workspaceId: workspaceOid,
      chargedAt: { $gte: bounds.start, $lte: bounds.end },
      creditsUsed: { $gt: 0 },
    };
    if (botIds.length > 0) {
      ledgerMatch.botId = { $in: botIds.map((id) => new Types.ObjectId(id)) };
    }

    const ledgerRows = (await this.usageLedgerModel
      .find(ledgerMatch)
      .select('botId creditsUsed chargedAt billingPeriodStart billingPeriodEnd messageId')
      .sort({ chargedAt: 1 })
      .lean()
      .exec()) as UsageLedgerLean[];

    const monthlyLimit = entitlements.monthlyAiCredits;
    const usageTrend = this.buildUsageTrend(ledgerRows, startDate, endDate, monthlyLimit);
    const aiCreditsByAgent = this.buildAiCreditsByAgent(ledgerRows, botNameById, monthlyLimit);

    const trainedKnowledgeByAgent = await this.loadTrainedKnowledgeByAgent(
      workspaceBots,
      botIds.length > 0 ? new Set(botIds) : null,
    );

    return {
      dateRange: { startDate, endDate },
      usageTrend,
      aiCreditsByAgent,
      trainedKnowledgeByAgent,
    };
  }

  private emptyResponse(startDate: string, endDate: string): WorkspaceUsageAnalyticsResponse {
    return {
      dateRange: { startDate, endDate },
      usageTrend: enumerateUtcDaysInclusive(startDate, endDate).map((date) => ({
        date,
        totalCreditsUsed: 0,
        monthlyCreditsUsed: 0,
        topUpCreditsUsed: 0,
      })),
      aiCreditsByAgent: [],
      trainedKnowledgeByAgent: [],
    };
  }

  private buildUsageTrend(
    rows: UsageLedgerLean[],
    startDate: string,
    endDate: string,
    monthlyLimit: number,
  ): WorkspaceUsageTrendDay[] {
    const dayMap = new Map<string, WorkspaceUsageTrendDay>();
    for (const date of enumerateUtcDaysInclusive(startDate, endDate)) {
      dayMap.set(date, {
        date,
        totalCreditsUsed: 0,
        monthlyCreditsUsed: 0,
        topUpCreditsUsed: 0,
      });
    }

    let periodKey = '';
    let monthlyAllocatedInPeriod = 0;

    for (const row of rows) {
      const creditsUsed = Math.max(0, row.creditsUsed ?? 0);
      if (creditsUsed <= 0) continue;

      const nextPeriodKey = billingPeriodKey(row.billingPeriodStart, row.billingPeriodEnd);
      if (nextPeriodKey !== periodKey) {
        periodKey = nextPeriodKey;
        monthlyAllocatedInPeriod = 0;
      }

      const monthlyRemaining = Math.max(0, monthlyLimit - monthlyAllocatedInPeriod);
      const split = allocateCreditsToPools(creditsUsed, monthlyRemaining);
      monthlyAllocatedInPeriod += split.monthlyCreditsUsed;

      const chargedAt = row.chargedAt instanceof Date ? row.chargedAt : new Date(row.chargedAt ?? Date.now());
      const day = utcYmdFromDate(chargedAt);
      const bucket = dayMap.get(day);
      if (!bucket) continue;

      bucket.monthlyCreditsUsed += split.monthlyCreditsUsed;
      bucket.topUpCreditsUsed += split.topUpCreditsUsed;
      bucket.totalCreditsUsed += creditsUsed;
    }

    return [...dayMap.values()];
  }

  private buildAiCreditsByAgent(
    rows: UsageLedgerLean[],
    botNameById: Map<string, string>,
    monthlyLimit: number,
  ): WorkspaceAiCreditsByAgentRow[] {
    const byBot = new Map<
      string,
      {
        totalCreditsUsed: number;
        monthlyCreditsUsed: number;
        topUpCreditsUsed: number;
        messageCount: number;
      }
    >();

    let periodKey = '';
    let monthlyAllocatedInPeriod = 0;

    for (const row of rows) {
      const botId = String(row.botId);
      const creditsUsed = Math.max(0, row.creditsUsed ?? 0);
      if (creditsUsed <= 0) continue;

      const nextPeriodKey = billingPeriodKey(row.billingPeriodStart, row.billingPeriodEnd);
      if (nextPeriodKey !== periodKey) {
        periodKey = nextPeriodKey;
        monthlyAllocatedInPeriod = 0;
      }

      const monthlyRemaining = Math.max(0, monthlyLimit - monthlyAllocatedInPeriod);
      const split = allocateCreditsToPools(creditsUsed, monthlyRemaining);
      monthlyAllocatedInPeriod += split.monthlyCreditsUsed;

      const existing = byBot.get(botId) ?? {
        totalCreditsUsed: 0,
        monthlyCreditsUsed: 0,
        topUpCreditsUsed: 0,
        messageCount: 0,
      };
      existing.totalCreditsUsed += creditsUsed;
      existing.monthlyCreditsUsed += split.monthlyCreditsUsed;
      existing.topUpCreditsUsed += split.topUpCreditsUsed;
      existing.messageCount += 1;
      byBot.set(botId, existing);
    }

    return [...byBot.entries()]
      .map(([botId, stats]) => ({
        botId,
        botName: botNameById.get(botId) ?? 'Agent',
        ...stats,
      }))
      .sort((a, b) => b.totalCreditsUsed - a.totalCreditsUsed);
  }

  private async loadTrainedKnowledgeByAgent(
    bots: WorkspaceCustomerBotLean[],
    botIdFilter: Set<string> | null,
  ): Promise<WorkspaceTrainedKnowledgeByAgentRow[]> {
    const filtered = botIdFilter
      ? bots.filter((bot) => botIdFilter.has(String(bot._id)))
      : bots;

    const rows = await Promise.all(
      filtered.map(async (bot) => {
        const usage = await this.knowledgeUsageService.getActiveBotKnowledgeUsage(bot._id, bot);
        return mapBotKnowledgeUsageRow({
          botId: String(bot._id),
          botName: String(bot.name ?? '').trim() || 'Untitled agent',
          usage,
        });
      }),
    );

    return rows
      .map((row) => ({
        botId: row.botId,
        botName: row.botName,
        usedMb: row.usedMb,
        maxMb: row.maxMb,
        percentUsed: row.percentUsed,
      }))
      .sort((a, b) => b.percentUsed - a.percentUsed);
  }
}
