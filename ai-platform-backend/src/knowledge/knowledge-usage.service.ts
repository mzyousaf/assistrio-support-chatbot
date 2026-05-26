import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { shouldResolveKnowledgeSizeFromWorkspaceEntitlements } from '../entitlements/bot-knowledge-size-from-entitlements.util';
import { BotKnowledgeSizeResolverService } from '../entitlements/bot-knowledge-size-resolver.service';
import {
  buildKnowledgeUsageWithLimit,
  calculateKnowledgeUsageFromItems,
  emptyKnowledgeUsageBreakdown,
  type BotForKnowledgeUsageLimit,
  type KnowledgeBaseItemUsageLean,
  type KnowledgeUsageBreakdown,
  KNOWLEDGE_USAGE_LEAN_FIELDS,
  knowledgeItemNotDeletedClause,
} from './knowledge-usage.util';

const USAGE_SELECT = KNOWLEDGE_USAGE_LEAN_FIELDS as unknown as string;

@Injectable()
export class KnowledgeUsageService {
  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    private readonly knowledgeSizeResolver: BotKnowledgeSizeResolverService,
  ) {}

  /**
   * Bytes used by active, non-soft-deleted KB rows for a bot (see {@link knowledgeBaseItemEligibleForKbUsageAggregation}).
   * Optional `bot` adds plan limit fields; workspace bots without persisted quota use plan entitlements.
   */
  async getActiveBotKnowledgeUsage(
    botId: Types.ObjectId | string,
    bot?: BotForKnowledgeUsageLimit,
  ): Promise<KnowledgeUsageBreakdown> {
    if (!Types.ObjectId.isValid(String(botId))) {
      return buildKnowledgeUsageWithLimit(emptyKnowledgeUsageBreakdown(), bot);
    }
    const rows = await this.itemModel
      .find({
        botId: new Types.ObjectId(String(botId)),
        $and: [knowledgeItemNotDeletedClause()],
      })
      .select(USAGE_SELECT)
      .lean();
    const base = calculateKnowledgeUsageFromItems(rows as KnowledgeBaseItemUsageLean[]);

    if (bot && shouldResolveKnowledgeSizeFromWorkspaceEntitlements(bot)) {
      const resolved = await this.knowledgeSizeResolver.resolveForBotLean(bot);
      return buildKnowledgeUsageWithLimit(base, bot, resolved);
    }

    return buildKnowledgeUsageWithLimit(base, bot);
  }
}
