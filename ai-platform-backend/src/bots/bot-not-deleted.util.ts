/**
 * Bot soft-delete mirrors {@link KnowledgeBaseItem}: `active !== false` and no `deletedAt`.
 */
export function botNotDeletedClause(): Record<string, unknown> {
  return {
    $and: [
      { active: { $ne: false } },
      {
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      },
    ],
  };
}

/** True when the bot is removed (soft-delete) and must not serve widget, chat, or retrieval. */
export function botIsEffectivelyDeleted(
  bot: { active?: boolean; deletedAt?: Date | null } | null | undefined,
): boolean {
  if (!bot) return true;
  if (bot.active === false) return true;
  const d = bot.deletedAt;
  return d instanceof Date && !isNaN(d.getTime());
}
