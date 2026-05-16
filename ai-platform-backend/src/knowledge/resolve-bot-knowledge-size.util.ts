import {
  DEFAULT_BOT_KNOWLEDGE_SIZE,
  type BotKnowledgeSizeStored,
  type BotKnowledgeSizeType,
} from './knowledge-plan-limits';

/** Effective quota used by services (audit fields omitted). */
export type ResolvedBotKnowledgeSize = {
  type: BotKnowledgeSizeType;
  baseMaxBytes: number;
  extraMaxBytes: number;
  maxBytes: number;
  lastPaidAt: Date | null;
  expiresAt: Date | null;
};

function toResolvedDefault(): ResolvedBotKnowledgeSize {
  const d = DEFAULT_BOT_KNOWLEDGE_SIZE;
  return {
    type: d.type,
    baseMaxBytes: d.baseMaxBytes,
    extraMaxBytes: d.extraMaxBytes,
    maxBytes: d.maxBytes,
    lastPaidAt: d.lastPaidAt ?? null,
    expiresAt: d.expiresAt ?? null,
  };
}

function asDateOrNull(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  return null;
}

function normalizeKnowledgeSizeType(raw: unknown): BotKnowledgeSizeType {
  if (raw === 'paid_addon' || raw === 'custom' || raw === 'default') return raw;
  return 'default';
}

/**
 * Returns effective KB storage quota for a bot.
 * Legacy documents without `botConfig` resolve to {@link DEFAULT_BOT_KNOWLEDGE_SIZE}.
 * Invalid or non-positive `maxBytes` falls back to defaults for the whole resolved view.
 */
export function resolveBotKnowledgeSizeConfig(
  bot: { botConfig?: { knowledgeSize?: Partial<BotKnowledgeSizeStored> | null } | null } | null | undefined,
): ResolvedBotKnowledgeSize {
  const ks = bot?.botConfig?.knowledgeSize;
  if (!ks || typeof ks !== 'object') {
    return toResolvedDefault();
  }

  const maxBytes = ks.maxBytes;
  if (typeof maxBytes !== 'number' || !Number.isFinite(maxBytes) || maxBytes <= 0) {
    return toResolvedDefault();
  }

  return {
    type: normalizeKnowledgeSizeType(ks.type),
    baseMaxBytes:
      typeof ks.baseMaxBytes === 'number' && Number.isFinite(ks.baseMaxBytes) && ks.baseMaxBytes > 0
        ? ks.baseMaxBytes
        : DEFAULT_BOT_KNOWLEDGE_SIZE.baseMaxBytes,
    extraMaxBytes:
      typeof ks.extraMaxBytes === 'number' && Number.isFinite(ks.extraMaxBytes) && ks.extraMaxBytes >= 0
        ? ks.extraMaxBytes
        : DEFAULT_BOT_KNOWLEDGE_SIZE.extraMaxBytes,
    maxBytes,
    lastPaidAt: asDateOrNull(ks.lastPaidAt),
    expiresAt: asDateOrNull(ks.expiresAt),
  };
}
