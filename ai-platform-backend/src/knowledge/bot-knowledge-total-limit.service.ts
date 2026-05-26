import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { KnowledgeBaseItem, type KnowledgeBaseItemSourceType } from '../models/knowledge-base-item.schema';
import {
  calculateKnowledgeItemUsageBytes,
  knowledgeBaseItemEligibleForKbUsageAggregation,
  knowledgeItemNotDeletedClause,
  KNOWLEDGE_USAGE_LEAN_FIELDS,
  type KnowledgeBaseItemUsageLean,
} from './knowledge-usage.util';
import { KnowledgeUsageService } from './knowledge-usage.service';
import { BotKnowledgeSizeResolverService } from '../entitlements/bot-knowledge-size-resolver.service';
import type { BotForKnowledgeUsageLimit } from './knowledge-usage.util';

export const PLAN_LIMIT_BOT_KB_TOTAL_CODE = 'plan_limit_bot_kb_total' as const;

/** User-facing copy for APIs and `displayMessage` when storage quota blocks training/import. */
export const PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE =
  'This agent has reached its knowledge limit. Delete some knowledge or buy more storage.';

export function isPlanLimitBotKbTotalCode(value: string | null | undefined): boolean {
  return String(value ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE;
}

/**
 * Mongo `$match/$and` clause: excludes KB rows blocked by workspace storage cap.
 * Rows stay `failed` with `trainingError` / import / extraction error code `plan_limit_bot_kb_total` until reconcile.
 */
export function knowledgeItemNotBlockedByPlanLimitBotKbTotalMongoClause(): {
  $nor: Array<Record<string, string>>;
} {
  const c = PLAN_LIMIT_BOT_KB_TOTAL_CODE;
  return {
    $nor: [{ trainingError: c }, { extractionError: c }, { 'tableMeta.importError': c }, { 'tableMeta.importErrorCode': c }],
  };
}

/** True when this KB row carries any `plan_limit_bot_kb_total` error (customer “out_of_storage”). */
export function knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal(row: Record<string, unknown>): boolean {
  if (isPlanLimitBotKbTotalCode(typeof row.trainingError === 'string' ? row.trainingError : null)) {
    return true;
  }
  if (isPlanLimitBotKbTotalCode(typeof row.extractionError === 'string' ? row.extractionError : null)) {
    return true;
  }
  const tm = row.tableMeta as { importError?: unknown; importErrorCode?: unknown } | null | undefined;
  if (!tm || typeof tm !== 'object') return false;
  if (isPlanLimitBotKbTotalCode(typeof tm.importError === 'string' ? tm.importError : null)) return true;
  if (isPlanLimitBotKbTotalCode(typeof tm.importErrorCode === 'string' ? tm.importErrorCode : null))
    return true;
  return false;
}

export type PlanLimitBotKbTotalPayload = {
  error: string;
  message: string;
  errorCode: typeof PLAN_LIMIT_BOT_KB_TOTAL_CODE;
  maxBytes: number;
  currentBytes: number;
  oldItemBytes: number;
  incomingBytes: number;
  newItemBytes: number;
  projectedBytes: number;
  remainingBytes: number;
};

function isPlanLimitPayload(x: unknown): x is PlanLimitBotKbTotalPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as PlanLimitBotKbTotalPayload).errorCode === PLAN_LIMIT_BOT_KB_TOTAL_CODE
  );
}

export function isPlanLimitBotKbTotalHttpException(err: unknown): err is HttpException {
  if (!(err instanceof HttpException)) return false;
  const body = err.getResponse();
  return isPlanLimitPayload(body);
}

export function planLimitPayloadFromHttpException(err: HttpException): PlanLimitBotKbTotalPayload | null {
  const body = err.getResponse();
  return isPlanLimitPayload(body) ? body : null;
}

@Injectable()
export class BotKnowledgeTotalLimitService {
  constructor(
    private readonly knowledgeUsageService: KnowledgeUsageService,
    private readonly knowledgeSizeResolver: BotKnowledgeSizeResolverService,
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
  ) {}

  private async loadBotForLimit(botId: string): Promise<BotForKnowledgeUsageLimit> {
    if (!Types.ObjectId.isValid(botId)) return null;
    const b = await this.botModel.findById(new Types.ObjectId(botId)).select('workspaceId botConfig').lean();
    return b as BotForKnowledgeUsageLimit;
  }

  private async resolveMaxBytes(bot: BotForKnowledgeUsageLimit): Promise<number> {
    const resolved = await this.knowledgeSizeResolver.resolveForBotLean(bot);
    return resolved.maxBytes;
  }

  private async sumEligibleBytesForFilter(botId: string, filter: Record<string, unknown>): Promise<number> {
    if (!Types.ObjectId.isValid(botId)) return 0;
    const rows = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        $and: [filter, knowledgeItemNotDeletedClause()],
      } as never)
      .select(KNOWLEDGE_USAGE_LEAN_FIELDS as unknown as string)
      .lean();
    let sum = 0;
    for (const row of rows as KnowledgeBaseItemUsageLean[]) {
      if (!knowledgeBaseItemEligibleForKbUsageAggregation(row)) continue;
      sum += calculateKnowledgeItemUsageBytes(row);
    }
    return sum;
  }

  async sumReplacingItemBytes(botId: string, itemIds: Types.ObjectId[]): Promise<number> {
    if (itemIds.length === 0) return 0;
    const uniq = [...new Set(itemIds.map((id) => String(id)))].filter((id) => Types.ObjectId.isValid(id));
    if (uniq.length === 0) return 0;
    return this.sumEligibleBytesForFilter(botId, {
      _id: { $in: uniq.map((id) => new Types.ObjectId(id)) },
    });
  }

  async sumReplacingSourceTypeBytes(
    botId: string,
    sourceTypes: KnowledgeBaseItemSourceType[],
  ): Promise<number> {
    if (sourceTypes.length === 0) return 0;
    return this.sumEligibleBytesForFilter(botId, { sourceType: { $in: sourceTypes } });
  }

  private static isReplaceOperation(input: {
    replacingItemIds?: Types.ObjectId[];
    replacingSourceTypes?: KnowledgeBaseItemSourceType[];
  }): boolean {
    return Boolean(input.replacingItemIds?.length || input.replacingSourceTypes?.length);
  }

  /**
   * `projectedBytes = currentStoredBytes - replacingBytes + incomingBytes`.
   * Replace: allow if `projectedBytes <= maxBytes` OR `incomingBytes <= replacingBytes` (same-size metadata,
   * reducing content, or net-neutral splice — do **not** throw `plan_limit` solely because `currentBytes > max`).
   * Pure add: allow only if `currentStoredBytes < maxBytes` and `projectedBytes <= maxBytes`.
   */
  async evaluateProjectedUsage(
    botId: string,
    input: {
      replacingItemIds?: Types.ObjectId[];
      replacingSourceTypes?: KnowledgeBaseItemSourceType[];
      incomingBytes: number;
    },
  ): Promise<{
    ok: boolean;
    maxBytes: number;
    currentBytes: number;
    replacingBytes: number;
    incomingBytes: number;
    projectedBytes: number;
    remainingBytes: number;
    bot: BotForKnowledgeUsageLimit;
    isReplaceOperation: boolean;
  }> {
    const bot = await this.loadBotForLimit(botId);
    const maxBytes = await this.resolveMaxBytes(bot);
    const usage = await this.knowledgeUsageService.getActiveBotKnowledgeUsage(botId, bot);
    const currentBytes = usage.totalBytes;
    let replacingBytes = 0;
    if (input.replacingItemIds?.length) {
      replacingBytes += await this.sumReplacingItemBytes(botId, input.replacingItemIds);
    }
    if (input.replacingSourceTypes?.length) {
      replacingBytes += await this.sumReplacingSourceTypeBytes(botId, input.replacingSourceTypes);
    }
    const incomingBytes = Math.max(0, Math.floor(input.incomingBytes));
    const projectedBytes = currentBytes - replacingBytes + incomingBytes;
    const remainingBytes = maxBytes - currentBytes;
    const isReplace = BotKnowledgeTotalLimitService.isReplaceOperation(input);
    let ok: boolean;
    if (!isReplace) {
      ok = currentBytes < maxBytes && projectedBytes <= maxBytes;
    } else {
      ok = projectedBytes <= maxBytes || incomingBytes <= replacingBytes;
    }
    return {
      ok,
      maxBytes,
      currentBytes,
      replacingBytes,
      incomingBytes,
      projectedBytes,
      remainingBytes,
      bot,
      isReplaceOperation: isReplace,
    };
  }

  assertProjectedWithinLimit(
    evalResult: Awaited<ReturnType<BotKnowledgeTotalLimitService['evaluateProjectedUsage']>>,
  ): asserts evalResult is typeof evalResult & { ok: true } {
    if (evalResult.ok) return;
    const { maxBytes, currentBytes, incomingBytes, projectedBytes, remainingBytes, replacingBytes } = evalResult;
    const payload: PlanLimitBotKbTotalPayload = {
      error: PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE,
      message: PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE,
      errorCode: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
      maxBytes,
      currentBytes,
      oldItemBytes: replacingBytes,
      incomingBytes,
      newItemBytes: incomingBytes,
      projectedBytes,
      remainingBytes,
    };
    throw new HttpException(payload, HttpStatus.BAD_REQUEST);
  }

  async assertWithinLimit(
    botId: string,
    input: {
      replacingItemIds?: Types.ObjectId[];
      replacingSourceTypes?: KnowledgeBaseItemSourceType[];
      incomingBytes: number;
    },
  ): Promise<void> {
    const r = await this.evaluateProjectedUsage(botId, input);
    this.assertProjectedWithinLimit(r);
  }

  /**
   * Blocks **new** KB content (upload, import session, new FAQ row, etc.) when stored usage is already at or over cap.
   */
  async assertStoredBytesBelowCapForNewContent(botId: string): Promise<void> {
    const bot = await this.loadBotForLimit(botId);
    const maxBytes = await this.resolveMaxBytes(bot);
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) return;
    const usage = await this.knowledgeUsageService.getActiveBotKnowledgeUsage(botId, bot);
    const currentBytes = usage.totalBytes;
    if (currentBytes < maxBytes) return;
    const payload: PlanLimitBotKbTotalPayload = {
      error: PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE,
      message: PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE,
      errorCode: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
      maxBytes,
      currentBytes,
      oldItemBytes: 0,
      incomingBytes: 0,
      newItemBytes: 0,
      projectedBytes: currentBytes,
      remainingBytes: maxBytes - currentBytes,
    };
    throw new HttpException(payload, HttpStatus.BAD_REQUEST);
  }
}
