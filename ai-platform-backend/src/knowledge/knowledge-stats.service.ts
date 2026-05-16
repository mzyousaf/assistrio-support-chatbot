import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { knowledgeItemNotDeletedClause } from './knowledge-base-item-access.service';
import { estimateTextMetricsFromKnowledgeItemLean } from './knowledge-text-metrics';
import { normalizeKnowledgeTrainingStatus } from './knowledge-training-status.util';
import { kbLastSuccessfulTrainInstant } from './knowledge-base-item-canonical.util';
import type { KnowledgeBaseItemTrainingStatus } from '../models/knowledge-base-item.schema';
import {
  type BotKnowledgeStats,
  type BotKnowledgeStatsByType,
  type BotKnowledgeTypeStats,
} from '../models/bot-knowledge-stats.schema';

type UiBucket = 'snippets' | 'qna' | 'documents' | 'datasheets' | 'suggestions';

function emptyTypeRow(): BotKnowledgeTypeStats {
  return { items: 0, characters: 0, rows: 0 };
}

function emptyByType(): BotKnowledgeStatsByType {
  return {
    snippets: emptyTypeRow(),
    qna: emptyTypeRow(),
    documents: emptyTypeRow(),
    datasheets: emptyTypeRow(),
    suggestions: emptyTypeRow(),
  };
}

/**
 * faq → qna, note → snippets, table → datasheets, document/url/html → documents, suggestion → suggestions (when exists).
 */
export function mapSourceTypeToUiBucket(st: string): UiBucket {
  if (st === 'faq') return 'qna';
  if (st === 'note') return 'snippets';
  if (st === 'table') return 'datasheets';
  if (st === 'document' || st === 'url' || st === 'html') return 'documents';
  if (st === 'suggestion') return 'suggestions';
  return 'documents';
}

function maxDate(...dates: (Date | undefined)[]): Date | undefined {
  const t = dates.filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
  if (t.length === 0) return undefined;
  return new Date(Math.max(...t.map((d) => d.getTime())));
}

/**
 * Character count for `bot.knowledgeStats` from stored `characterCount` or embedded-text estimate.
 * Exported for unit tests — callers should use {@link KnowledgeStatsService.recalculateKnowledgeStatsForBot} at runtime.
 */
export function getCharacterCountForKbItemStats(item: {
  sourceType: string;
  content?: string;
  title?: string;
  characterCount?: number;
  faqMeta?: { title?: string; questions?: string[]; answer?: string };
  rawContent?: string;
  suggestionMeta?: { scopedInformation?: string };
}): number {
  const c = item.characterCount;
  if (typeof c === 'number' && c >= 0) return c;
  return estimateTextMetricsFromKnowledgeItemLean(item).characterCount;
}

function datasheetRowCountFromRaw(rawContent: string | undefined): number {
  if (!rawContent) return 0;
  try {
    const p = JSON.parse(rawContent) as { rows?: unknown[] };
    return Array.isArray(p.rows) ? p.rows.length : 0;
  } catch {
    return 0;
  }
}

@Injectable()
export class KnowledgeStatsService {
  constructor(
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
  ) {}

  /**
   * Recompute and persist `bot.knowledgeStats` from live knowledge base items
   * (see {@link knowledgeItemNotDeletedClause}).
   */
  async recalculateKnowledgeStatsForBot(botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const botOid = new Types.ObjectId(botId);
    await this.itemModel.collection.updateMany(
      { botId: botOid, status: 'ui_only', $and: [knowledgeItemNotDeletedClause()] },
      { $set: { status: 'pending', updatedAt: new Date() } },
    );

    const items = await this.itemModel
      .find({ botId: botOid, $and: [knowledgeItemNotDeletedClause()] })
      .lean()
      .exec();

    const byType = emptyByType();
    const stChars: Record<KnowledgeBaseItemTrainingStatus, number> = {
      pending: 0,
      queued: 0,
      processing: 0,
      ready: 0,
      failed: 0,
    };
    const stItems: Record<KnowledgeBaseItemTrainingStatus, number> = {
      pending: 0,
      queued: 0,
      processing: 0,
      ready: 0,
      failed: 0,
    };

    let totalCharacters = 0;
    const lastTimes: {
      lastContent?: Date;
      lastQueued?: Date;
      lastTrainingStart?: Date;
      lastTrained?: Date;
    } = {};

    for (const it of items) {
      const c = getCharacterCountForKbItemStats(it as Parameters<typeof getCharacterCountForKbItemStats>[0]);
      totalCharacters += c;

      const st = (it as { sourceType: string }).sourceType;
      const bucket = mapSourceTypeToUiBucket(st);
      const b = byType[bucket] as BotKnowledgeTypeStats;
      b.items += 1;
      b.characters += c;
      if (bucket === 'datasheets') {
        b.rows += datasheetRowCountFromRaw((it as { rawContent?: string }).rawContent);
      }

      const training = normalizeKnowledgeTrainingStatus((it as { status?: string }).status);
      stChars[training] += c;
      stItems[training] += 1;

      lastTimes.lastContent = maxDate(
        lastTimes.lastContent,
        (it as { lastContentUpdatedAt?: Date }).lastContentUpdatedAt,
        (it as { updatedAt?: Date }).updatedAt,
      );
      lastTimes.lastQueued = maxDate(
        lastTimes.lastQueued,
        (it as { lastQueuedAt?: Date }).lastQueuedAt,
      );
      lastTimes.lastTrainingStart = maxDate(
        lastTimes.lastTrainingStart,
        (it as { lastTrainingStartedAt?: Date }).lastTrainingStartedAt,
      );
      lastTimes.lastTrained = maxDate(
        lastTimes.lastTrained,
        kbLastSuccessfulTrainInstant(it as { lastTrainedAt?: Date }),
      );
    }

    const stats: BotKnowledgeStats = {
      totalCharacters,
      totalItems: items.length,
      readyCharacters: stChars.ready,
      pendingCharacters: stChars.pending,
      queuedCharacters: stChars.queued,
      processingCharacters: stChars.processing,
      failedCharacters: stChars.failed,
      uiOnlyCharacters: 0,
      readyItems: stItems.ready,
      pendingItems: stItems.pending,
      queuedItems: stItems.queued,
      processingItems: stItems.processing,
      failedItems: stItems.failed,
      uiOnlyItems: 0,
      byType,
      lastUpdatedAt: lastTimes.lastContent,
      lastQueuedAt: lastTimes.lastQueued,
      lastTrainingStartedAt: lastTimes.lastTrainingStart,
      lastTrainedAt: lastTimes.lastTrained,
    };

    await this.botModel.updateOne(
      { _id: botOid },
      {
        $set: { knowledgeStats: stats },
      },
    );
  }
}
