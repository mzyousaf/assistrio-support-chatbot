import type { NavigateFunction } from 'react-router-dom';
import type { ApiResult } from '@/api/types';
import { postCustomerBotKnowledgeItemsBulkDelete } from '@/api/customerApi';
import { appToast } from '@/lib/app-toast';
import { tryHandleCustomerResourceGone } from '@/lib/customerResourceUnavailable';
import { kbPlanLimitClientDescription } from '@/lib/knowledgeContentUtf8Limits';
import { isKnowledgeTrainingBusyError, knowledgeTrainingBusyConflictMessage } from '@/lib/knowledgeTrainingBusyConflict';

const KB_TABLE_IMPORT_BUSY = 'kb_table_import_busy';

/** Shown when a row lacks a synced knowledge item id and bulk replace is unavailable. */
export const KB_DELETE_REQUIRES_SYNC_MESSAGE =
  'Knowledge is still syncing. Try deleting again in a moment.';

/**
 * After a failed KB item delete (`POST …/items/bulk-delete` or single-id wrapper): toasts and optional redirect when the row is gone (detail routes).
 * @returns `true` when the error was handled (caller should stop).
 */
export function reportCustomerKnowledgeItemDeleteRejected(
  navigate: NavigateFunction,
  res: ApiResult<unknown>,
  options: {
    /** When set, missing KB row navigates here (e.g. section list tab). */
    redirectListOnKbGone?: string;
    notifyPlanLimitFromApi: (r: ApiResult<unknown>) => boolean;
  },
): boolean {
  if (res.ok) return false;
  const code = (res.errorCode ?? '').toLowerCase();
  const gone = res.status === 404 || code === 'kb_item_not_found' || code === 'not_found';

  if (gone && options.redirectListOnKbGone) {
    if (tryHandleCustomerResourceGone(navigate, res, options.redirectListOnKbGone)) return true;
  }
  if (gone && !options.redirectListOnKbGone) {
    appToast.error('This knowledge item was already removed or could not be found.');
    return true;
  }
  if (options.notifyPlanLimitFromApi(res)) return true;
  if (isKnowledgeTrainingBusyError(res)) {
    appToast.error('Training busy', {
      description: knowledgeTrainingBusyConflictMessage(res),
    });
    return true;
  }
  if (code === KB_TABLE_IMPORT_BUSY) {
    appToast.error('Import in progress', {
      description:
        (typeof res.error === 'string' && res.error.trim()) ||
        'Finish or cancel the datasheet import before deleting this datasheet.',
    });
    return true;
  }
  if (code === 'kb_delete_concurrent_conflict') {
    appToast.error('Knowledge updated elsewhere', {
      description:
        (typeof res.error === 'string' && res.error.trim()) ||
        'Refresh this page and try deleting again.',
    });
    return true;
  }
  appToast.error('Could not remove', {
    description: kbPlanLimitClientDescription(res.errorCode, res.error, res.body),
  });
  return true;
}

/** One `POST …/knowledge/items/bulk-delete`; first failing step’s error is returned. */
export async function bulkDeleteCustomerKnowledgeItems(
  botId: string,
  itemIds: readonly string[],
): Promise<ApiResult<{ ok: true }>> {
  const ids = itemIds.map((raw) => (typeof raw === 'string' ? raw.trim().toLowerCase() : '')).filter(Boolean);
  if (ids.length === 0) {
    return { ok: true, data: { ok: true }, status: 200 };
  }
  const res = await postCustomerBotKnowledgeItemsBulkDelete(botId, [...ids]);
  if (!res.ok) return res;
  return { ok: true, data: { ok: true }, status: res.status };
}

/** @deprecated Use {@link bulkDeleteCustomerKnowledgeItems} — name preserved for backward compatibility. */
export const deleteCustomerKnowledgeItemsSequential = bulkDeleteCustomerKnowledgeItems;
