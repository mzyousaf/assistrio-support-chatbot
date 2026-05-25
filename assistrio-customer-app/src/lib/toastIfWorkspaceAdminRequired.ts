import { appToast } from './app-toast';
import { BOT_WORKSPACE_ADMIN_ONLY_MANAGE_TOAST, isWorkspaceAdminRequired } from './botsListMessages';

/** Show admin-only toast when a mutation API returns workspace_admin_required. */
export function toastIfWorkspaceAdminRequired(result: { ok: boolean; errorCode?: string }): boolean {
  if (isWorkspaceAdminRequired(result)) {
    appToast.error(BOT_WORKSPACE_ADMIN_ONLY_MANAGE_TOAST);
    return true;
  }
  return false;
}
