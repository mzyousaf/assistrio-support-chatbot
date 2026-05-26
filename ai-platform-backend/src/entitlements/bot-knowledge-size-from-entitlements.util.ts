import type { BotKnowledgeSizeStored } from '../knowledge/knowledge-plan-limits';
import { DEFAULT_BOT_KNOWLEDGE_SIZE } from '../knowledge/knowledge-plan-limits';
import type { WorkspaceEntitlements } from './workspace-entitlements.types';

export type EntitlementsKbSizeInput = Pick<
  WorkspaceEntitlements,
  'planName' | 'kbStorageBytesPerBot' | 'maxKbStorageBytesPerBot'
>;

/**
 * Builds `botConfig.knowledgeSize` for new customer bots from workspace plan entitlements.
 * Storage add-ons are not applied yet (base plan quota only).
 *
 * TODO(epic-6): Reconcile existing bots that still carry legacy 50 MiB schema defaults when a safe migration path exists.
 */
export function buildBotKnowledgeSizeFromEntitlements(
  entitlements: EntitlementsKbSizeInput,
): BotKnowledgeSizeStored {
  const maxBytes = Math.min(
    entitlements.kbStorageBytesPerBot,
    entitlements.maxKbStorageBytesPerBot,
  );
  return {
    type: 'default',
    baseMaxBytes: maxBytes,
    extraMaxBytes: 0,
    maxBytes,
    lastPaidAt: null,
    expiresAt: null,
    updatedAt: new Date(),
    updatedBy: null,
    note: `${entitlements.planName} plan`,
  };
}

/** True when the bot document has no usable persisted KB quota (safe to fill on finalize). */
export function botKnowledgeSizeConfigIsMissing(
  bot:
    | { botConfig?: { knowledgeSize?: Partial<BotKnowledgeSizeStored> | null } | null }
    | null
    | undefined,
): boolean {
  const ks = bot?.botConfig?.knowledgeSize;
  if (!ks || typeof ks !== 'object') return true;
  const maxBytes = ks.maxBytes;
  return typeof maxBytes !== 'number' || !Number.isFinite(maxBytes) || maxBytes <= 0;
}

/**
 * Mongoose `BotPlanConfig` defaults stamp 50 MiB with a null note before plan entitlements are applied.
 * Workspace bots should not enforce this legacy quota at runtime.
 */
export function botKnowledgeSizeUsesLegacySchemaDefault(
  bot:
    | { botConfig?: { knowledgeSize?: Partial<BotKnowledgeSizeStored> | null } | null }
    | null
    | undefined,
): boolean {
  const ks = bot?.botConfig?.knowledgeSize;
  if (!ks || typeof ks !== 'object') return false;
  if (ks.maxBytes !== DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes) return false;
  const note = typeof ks.note === 'string' ? ks.note.trim() : '';
  return note.length === 0;
}

/** Workspace bots missing quota or carrying the legacy 50 MiB schema default resolve from plan entitlements. */
export function shouldResolveKnowledgeSizeFromWorkspaceEntitlements(
  bot:
    | { botConfig?: { knowledgeSize?: Partial<BotKnowledgeSizeStored> | null } | null }
    | null
    | undefined,
): boolean {
  return botKnowledgeSizeConfigIsMissing(bot) || botKnowledgeSizeUsesLegacySchemaDefault(bot);
}
