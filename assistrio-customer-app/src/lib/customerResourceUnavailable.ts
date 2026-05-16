import { useCallback, useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { appToast } from '@/lib/app-toast';

export const MSG_DELETED_BOT = 'This agent was deleted or is no longer available.';
export const MSG_DELETED_KB_ITEM = 'This knowledge item was deleted.';

type CustomerFailResponse = {
  ok: boolean;
  status: number;
  error?: string;
  errorCode?: string;
};

/** Treat as "gone" for customer UX: soft-deleted or missing bot/KB row, without exposing purge. */
export function isCustomerResourceUnavailable(res: CustomerFailResponse): boolean {
  if (res.ok) return false;
  const c = (res.errorCode ?? '').toLowerCase();
  if (
    c === 'bot_not_found' ||
    c === 'document_not_found' ||
    c === 'kb_item_not_found' ||
    c === 'not_found' ||
    c === 'deleted'
  ) {
    return true;
  }
  if (res.status === 404) return true;
  return false;
}

/**
 * After a failed customer API call: toast + redirect when the bot or KB row is no longer available.
 * @param kbListPath When the bot still exists but a nested KB/document row is gone (list tab to open).
 */
export function tryHandleCustomerResourceGone(
  navigate: NavigateFunction,
  res: CustomerFailResponse,
  kbListPath?: string,
): boolean {
  if (!isCustomerResourceUnavailable(res)) return false;
  if (res.errorCode?.toLowerCase() === 'bot_not_found') {
    appToast.error(MSG_DELETED_BOT);
    void navigate('/bots', { replace: true });
    return true;
  }
  if (kbListPath) {
    appToast.error(MSG_DELETED_KB_ITEM);
    void navigate(kbListPath, { replace: true });
    return true;
  }
  appToast.error(MSG_DELETED_BOT);
  void navigate('/bots', { replace: true });
  return true;
}

/**
 * Training/overview polls: when the **workspace bot** is gone, leave the shell. Narrow KB 404s must not trigger this.
 */
export function redirectCustomerWorkspacePollGone(navigate: NavigateFunction, res: CustomerFailResponse): boolean {
  if (res.ok) return false;
  const c = (res.errorCode ?? '').toLowerCase();
  if (c === 'document_not_found' || c === 'kb_item_not_found') return false;
  if (!isCustomerResourceUnavailable(res)) return false;
  appToast.error(MSG_DELETED_BOT);
  void navigate('/bots', { replace: true });
  return true;
}

/** Fire {@link MSG_DELETED_KB_ITEM} at most once per `resetDeps` cycle (StrictMode-safe). */
export function useNotifyKbItemDeletedOnce(...resetDeps: unknown[]) {
  const ref = useRef(false);
  useEffect(() => {
    ref.current = false;
  }, resetDeps);
  return useCallback(() => {
    if (ref.current) return;
    ref.current = true;
    appToast.error(MSG_DELETED_KB_ITEM);
  }, []);
}
