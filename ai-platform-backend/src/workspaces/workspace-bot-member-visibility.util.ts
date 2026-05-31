/** Thrown when a workspace member cannot preview/test a bot in playground. */
export const WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE =
  "You don't have permission to preview this AI Agent. Ask a workspace owner or admin for access.";
export const WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE = 'workspace_bot_preview_access_denied';

export type BotWorkspaceMemberVisibilitySettings = {
  visibleToMembers: boolean;
  allowMemberPreview: boolean;
};

/** Defaults: members can see and preview (backward compatible). */
export const DEFAULT_BOT_WORKSPACE_MEMBER_VISIBILITY: BotWorkspaceMemberVisibilitySettings = {
  visibleToMembers: true,
  allowMemberPreview: true,
};

export function resolveBotWorkspaceMemberVisibility(
  bot: Record<string, unknown>,
): BotWorkspaceMemberVisibilitySettings {
  const raw =
    bot.workspaceMemberVisibility && typeof bot.workspaceMemberVisibility === 'object'
      ? (bot.workspaceMemberVisibility as Record<string, unknown>)
      : undefined;
  return {
    visibleToMembers: raw?.visibleToMembers !== false,
    allowMemberPreview: raw?.allowMemberPreview !== false,
  };
}

export function isBotVisibleToWorkspaceMembers(bot: Record<string, unknown>): boolean {
  return resolveBotWorkspaceMemberVisibility(bot).visibleToMembers;
}

export function isBotMemberPreviewAllowed(bot: Record<string, unknown>): boolean {
  return resolveBotWorkspaceMemberVisibility(bot).allowMemberPreview;
}

/** True when bot belongs to a workspace (uses workspace preview rules, not owner-only legacy). */
export function botHasWorkspaceScope(bot: Record<string, unknown>): boolean {
  const ws = bot.workspaceId;
  if (ws == null) return false;
  const id = String(ws).trim();
  return id.length > 0;
}

export function normalizeBotWorkspaceMemberVisibilityPatch(body: unknown): Partial<BotWorkspaceMemberVisibilitySettings> | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const out: Partial<BotWorkspaceMemberVisibilitySettings> = {};
  if ('visibleToMembers' in o) out.visibleToMembers = o.visibleToMembers !== false;
  if ('allowMemberPreview' in o) out.allowMemberPreview = o.allowMemberPreview !== false;
  return Object.keys(out).length ? out : null;
}
