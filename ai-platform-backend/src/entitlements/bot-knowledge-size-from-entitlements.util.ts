import type { BotKnowledgeSizeStored } from '../knowledge/knowledge-plan-limits';
import type { WorkspaceEntitlements } from './workspace-entitlements.types';

export type EntitlementsKbSizeInput = Pick<
  WorkspaceEntitlements,
  'planName' | 'kbStorageBytesPerBot' | 'maxKbStorageBytesPerBot'
>;

/**
 * Builds `botConfig.knowledgeSize` for new customer bots from workspace plan entitlements.
 * Storage add-ons are not applied yet (base plan quota only).
 *
 * TODO(epic-2): Reconcile existing bots that still carry legacy 50 MiB defaults when plan
 * migration / subscription upgrade flows are implemented.
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
