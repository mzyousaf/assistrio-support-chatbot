export const BOTS_LIST_ADMIN_ONLY_CREATE_NOTE = 'Only workspace admins can create new agents.';
export const BOTS_LIST_ADMIN_ONLY_CREATE_TOAST = 'Only workspace admins can create agents.';
export const BOT_WORKSPACE_READ_ONLY_NOTE = 'Only workspace admins can edit this agent.';
export const BOT_WORKSPACE_KNOWLEDGE_READ_ONLY_NOTE = 'Only workspace admins can edit this knowledge base.';
export const BOT_WORKSPACE_ADMIN_ONLY_MANAGE_TOAST = 'Only workspace admins can manage agents.';
export const BOTS_LIST_EMPTY_TITLE = 'No agents in this workspace yet';
export const BOTS_LIST_EMPTY_ADMIN_COPY = 'Create your first AI Agent for this workspace.';
export const BOTS_LIST_EMPTY_MEMBER_TITLE = 'No agents are available in this workspace.';
export const BOTS_LIST_EMPTY_MEMBER_COPY = 'Ask a workspace owner or admin to share an agent with you.';
export const BOTS_LIST_NO_ACTIVE_WORKSPACE = 'No active workspace is selected.';

export const WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE = 'workspace_bot_preview_access_denied';
export const WORKSPACE_BOT_ACCESS_DENIED_CODE = 'workspace_bot_access_denied';
export const WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE =
  "You don't have permission to preview this agent. Ask a workspace owner or admin for access.";
export const WORKSPACE_BOT_ACCESS_DENIED_MESSAGE =
  "You don't have access to this agent. Ask a workspace owner for access.";

export function isCreateDraftAdminDenied(result: { ok: boolean; errorCode?: string }): boolean {
  return result.ok === false && result.errorCode === 'workspace_access_denied';
}

export function isWorkspaceAdminRequired(result: { ok: boolean; errorCode?: string }): boolean {
  return result.ok === false && result.errorCode === 'workspace_admin_required';
}

export function isWorkspaceBotPreviewAccessDenied(result: { ok: boolean; errorCode?: string }): boolean {
  return result.ok === false && result.errorCode === WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE;
}

export function isWorkspaceBotAccessDenied(result: { ok: boolean; errorCode?: string }): boolean {
  return result.ok === false && result.errorCode === WORKSPACE_BOT_ACCESS_DENIED_CODE;
}
