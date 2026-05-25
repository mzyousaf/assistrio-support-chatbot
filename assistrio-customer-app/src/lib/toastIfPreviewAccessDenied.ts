import { appToast } from './app-toast';
import {
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
  isWorkspaceBotPreviewAccessDenied,
} from './botsListMessages';

/** Show preview-access toast when an API returns workspace_bot_preview_access_denied. */
export function toastIfPreviewAccessDenied(result: { ok: boolean; errorCode?: string }): boolean {
  if (isWorkspaceBotPreviewAccessDenied(result)) {
    appToast.error(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE);
    return true;
  }
  return false;
}
