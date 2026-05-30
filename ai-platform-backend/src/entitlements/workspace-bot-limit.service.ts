import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { botNotDeletedClause } from '../bots/bot-not-deleted.util';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import {
  isBotIdOverLimitLocked,
  resolveOverLimitLockedBotIds,
  WORKSPACE_BOT_LIMIT_EXCEEDED_LOCKED_REASON,
  type BotCreatedAtRecord,
} from './workspace-bot-over-limit.util';

export const PLAN_LIMIT_WORKSPACE_BOTS_CODE = 'plan_limit_workspace_bots' as const;

export const PLAN_LIMIT_WORKSPACE_BOTS_MESSAGE =
  'Your workspace has reached the bot limit for the current plan.';

export const WORKSPACE_BOT_LIMIT_EXCEEDED_CODE = 'workspace_bot_limit_exceeded' as const;

export const WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE =
  'This agent is inactive because your workspace is over its agent limit.';

export type WorkspaceBotLimitExceededPayload = {
  message: string;
  errorCode: typeof WORKSPACE_BOT_LIMIT_EXCEEDED_CODE;
  lockedReason: typeof WORKSPACE_BOT_LIMIT_EXCEEDED_LOCKED_REASON;
};

export type PlanLimitWorkspaceBotsUsage = {
  current: number;
  limit: number;
  planKey: string;
  planName: string;
};

export type PlanLimitWorkspaceBotsPayload = {
  message: string;
  errorCode: typeof PLAN_LIMIT_WORKSPACE_BOTS_CODE;
  usage: PlanLimitWorkspaceBotsUsage;
};

export function isPlanLimitWorkspaceBotsPayload(x: unknown): x is PlanLimitWorkspaceBotsPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as PlanLimitWorkspaceBotsPayload).errorCode === PLAN_LIMIT_WORKSPACE_BOTS_CODE
  );
}

export function isPlanLimitWorkspaceBotsHttpException(err: unknown): err is HttpException {
  if (!(err instanceof HttpException)) return false;
  return isPlanLimitWorkspaceBotsPayload(err.getResponse());
}

/** Mongo filter for customer-owned agents that count toward workspace bot limit. */
export function workspaceCustomerBotCountFilter(workspaceId: Types.ObjectId): Record<string, unknown> {
  return {
    workspaceId,
    $and: [
      botNotDeletedClause(),
      { $or: [{ isPlatformBot: { $exists: false } }, { isPlatformBot: false }] },
    ],
  };
}

@Injectable()
export class WorkspaceBotLimitService {
  constructor(
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  async countWorkspaceCustomerBots(
    workspaceId: string,
    options?: { excludeBotId?: string },
  ): Promise<number> {
    if (!Types.ObjectId.isValid(workspaceId)) return 0;
    const wsOid = new Types.ObjectId(workspaceId);
    const filter: Record<string, unknown> = workspaceCustomerBotCountFilter(wsOid);
    const exclude = String(options?.excludeBotId ?? '').trim();
    if (exclude && Types.ObjectId.isValid(exclude)) {
      filter._id = { $ne: new Types.ObjectId(exclude) };
    }
    return this.botModel.countDocuments(filter).exec();
  }

  async getWorkspaceBotUsage(workspaceId: string): Promise<PlanLimitWorkspaceBotsUsage> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const current = await this.countWorkspaceCustomerBots(workspaceId);

    return {
      current,
      limit: entitlements.botLimit,
      planKey: entitlements.planKey,
      planName: entitlements.planName,
    };
  }

  async listWorkspaceCustomerBotsForLimit(workspaceId: string): Promise<BotCreatedAtRecord[]> {
    if (!Types.ObjectId.isValid(workspaceId)) return [];
    const wsOid = new Types.ObjectId(workspaceId);
    const rows = await this.botModel
      .find(workspaceCustomerBotCountFilter(wsOid))
      .select({ _id: 1, createdAt: 1 })
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({
      id: String(row._id),
      createdAt: (row as { createdAt?: Date }).createdAt ?? null,
    }));
  }

  async resolveOverLimitLockedBotIdSet(workspaceId: string): Promise<Set<string>> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const bots = await this.listWorkspaceCustomerBotsForLimit(workspaceId);
    return resolveOverLimitLockedBotIds(bots, entitlements.botLimit);
  }

  async isBotOverLimitLocked(workspaceId: string, botId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(botId)) return false;
    const locked = await this.resolveOverLimitLockedBotIdSet(workspaceId);
    return isBotIdOverLimitLocked(botId, locked);
  }

  throwWorkspaceBotLimitExceeded(): never {
    const payload: WorkspaceBotLimitExceededPayload = {
      message: WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
      errorCode: WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
      lockedReason: WORKSPACE_BOT_LIMIT_EXCEEDED_LOCKED_REASON,
    };
    throw new HttpException(payload, HttpStatus.FORBIDDEN);
  }

  async assertWorkspaceBotWithinEffectiveLimit(workspaceId: string, botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(botId)) return;
    if (await this.isBotOverLimitLocked(workspaceId, botId)) {
      this.throwWorkspaceBotLimitExceeded();
    }
  }

  async assertBotDocWithinEffectiveLimitIfWorkspaceScoped(bot: {
    _id?: unknown;
    workspaceId?: unknown;
    isPlatformBot?: boolean;
  }): Promise<void> {
    if ((bot as { isPlatformBot?: boolean }).isPlatformBot === true) return;
    const workspaceId = bot.workspaceId != null ? String(bot.workspaceId).trim() : '';
    const botId = bot._id != null ? String(bot._id) : '';
    if (!workspaceId || !botId) return;
    await this.assertWorkspaceBotWithinEffectiveLimit(workspaceId, botId);
  }

  enrichBotListWithOverLimitState<T extends { _id: string }>(
    bots: T[],
    lockedIds: Set<string>,
  ): Array<
    T & {
      isOverLimitLocked: boolean;
      lockedReason?: typeof WORKSPACE_BOT_LIMIT_EXCEEDED_LOCKED_REASON;
      lockedMessage?: string;
    }
  > {
    return bots.map((bot) => {
      const isOverLimitLocked = isBotIdOverLimitLocked(bot._id, lockedIds);
      return {
        ...bot,
        isOverLimitLocked,
        ...(isOverLimitLocked
          ? {
              lockedReason: WORKSPACE_BOT_LIMIT_EXCEEDED_LOCKED_REASON,
              lockedMessage: WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
            }
          : {}),
      };
    });
  }

  async assertCanAddBotToWorkspace(
    workspaceId: string,
    options?: { excludeBotId?: string },
  ): Promise<void> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const current = await this.countWorkspaceCustomerBots(workspaceId, options);
    if (current < entitlements.botLimit) return;

    const payload: PlanLimitWorkspaceBotsPayload = {
      message: PLAN_LIMIT_WORKSPACE_BOTS_MESSAGE,
      errorCode: PLAN_LIMIT_WORKSPACE_BOTS_CODE,
      usage: {
        current,
        limit: entitlements.botLimit,
        planKey: entitlements.planKey,
        planName: entitlements.planName,
      },
    };
    throw new HttpException(payload, HttpStatus.FORBIDDEN);
  }
}
