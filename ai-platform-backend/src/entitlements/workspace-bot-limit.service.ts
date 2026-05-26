import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { botNotDeletedClause } from '../bots/bot-not-deleted.util';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

export const PLAN_LIMIT_WORKSPACE_BOTS_CODE = 'plan_limit_workspace_bots' as const;

export const PLAN_LIMIT_WORKSPACE_BOTS_MESSAGE =
  'Your workspace has reached the bot limit for the current plan.';

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
