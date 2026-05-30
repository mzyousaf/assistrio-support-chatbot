export const WORKSPACE_BOT_LIMIT_EXCEEDED_LOCKED_REASON = 'workspace_bot_limit_exceeded' as const;

export type BotCreatedAtRecord = {
  id: string;
  createdAt: Date | string | null | undefined;
};

/** Oldest bots stay active up to `botLimit`; newer bots above the limit are locked. */
export function resolveOverLimitLockedBotIds(
  bots: BotCreatedAtRecord[],
  botLimit: number,
): Set<string> {
  if (!Number.isFinite(botLimit) || botLimit < 0) {
    return new Set(bots.map((b) => b.id));
  }
  if (bots.length <= botLimit) {
    return new Set();
  }

  const sorted = [...bots].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  const locked = new Set<string>();
  for (let i = botLimit; i < sorted.length; i++) {
    locked.add(sorted[i].id);
  }
  return locked;
}

export function isBotIdOverLimitLocked(botId: string, lockedIds: Set<string>): boolean {
  return lockedIds.has(String(botId).trim());
}
