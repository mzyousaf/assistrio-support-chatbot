import { createHash } from 'crypto';
import type { Model, Types } from 'mongoose';
import type { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { normalizeKnowledgeReplyPrioritySettings } from './knowledge-reply-priority.util';
import { knowledgeRuntimeRetrievalMatchParts } from './knowledge-runtime-retrieval-eligibility.util';

export type RetrievalConfigForVersion = {
  includeNotesInKnowledge: boolean;
  knowledgeReplyPriority?: unknown;
};

/** Fingerprint of bot settings that change retrieval eligibility or ranking. */
export function buildRetrievalConfigFingerprint(config: RetrievalConfigForVersion): string {
  const priority = normalizeKnowledgeReplyPrioritySettings(config.knowledgeReplyPriority);
  const order = (priority.sourceOrder ?? []).join(',');
  return `notes:${config.includeNotesInKnowledge ? 1 : 0}|prio:${priority.mode}|${order}`;
}

/**
 * Stable KB version for retrieval cache: eligible-item max updatedAt + retrieval config.
 * Does not use bot.updatedAt (changes on unrelated bot saves).
 */
export async function buildRetrievalKnowledgeVersionStamp(
  itemModel: Model<KnowledgeBaseItem>,
  botOid: Types.ObjectId,
  config: RetrievalConfigForVersion,
): Promise<string> {
  const configFp = buildRetrievalConfigFingerprint(config);
  const match: Record<string, unknown> = {
    botId: botOid,
    $and: [
      ...knowledgeRuntimeRetrievalMatchParts(),
      ...(config.includeNotesInKnowledge ? [] : [{ sourceType: { $ne: 'note' } }]),
    ],
  };

  const rows = await itemModel
    .aggregate<{ maxUpdated: Date | null }>([
      { $match: match },
      { $group: { _id: null, maxUpdated: { $max: '$updatedAt' } } },
    ])
    .exec();

  const maxItemMs = rows[0]?.maxUpdated?.getTime() ?? 0;
  return `${configFp}|kb:${maxItemMs}`;
}

export function hashForRetrievalCacheDebug(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
