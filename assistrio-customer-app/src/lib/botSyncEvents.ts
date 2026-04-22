/** Dispatched after `BotWorkspaceContext.softReload` succeeds so the shell navbar can refetch agent summary. */
export const ASSISTRIO_NAVBAR_BOT_REFRESH = 'assistrio-navbar-refresh-bot';

/** Dispatched after navbar-driven lifecycle (publish/draft) succeeds so workspace pages can soft-reload bot state. */
export const ASSISTRIO_WORKSPACE_BOT_REFRESH = 'assistrio-workspace-refresh-bot';

export function requestNavbarBotRefresh(botId: string): void {
  window.dispatchEvent(new CustomEvent(ASSISTRIO_NAVBAR_BOT_REFRESH, { detail: { botId } }));
}

export function requestWorkspaceBotRefresh(botId: string): void {
  window.dispatchEvent(new CustomEvent(ASSISTRIO_WORKSPACE_BOT_REFRESH, { detail: { botId } }));
}
