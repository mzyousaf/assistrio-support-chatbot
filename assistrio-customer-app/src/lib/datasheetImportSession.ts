import type { ApiResult, CustomerDatasheetImportCancelResponse } from '@/api/types';

/** Cancel-after-preview may fail harmlessly if the session was already removed or the import was confirmed. */
export function isBenignDatasheetImportCancelResult(
  res: ApiResult<CustomerDatasheetImportCancelResponse>,
): boolean {
  if (res.ok) return true;
  const c = res.errorCode;
  return c === 'session_not_found' || c === 'session_already_consumed';
}

export function getDatasheetImportConfirmToast(
  res: Extract<ApiResult<unknown>, { ok: false }>,
): { variant: 'error' | 'info'; title: string; description: string } | null {
  const c = res.errorCode;
  if (c === 'import_session_cancelled') {
    return {
      variant: 'error',
      title: 'Import cancelled',
      description: 'This preview was cancelled. Upload the file again to import.',
    };
  }
  if (c === 'import_session_expired') {
    return {
      variant: 'error',
      title: 'Import preview expired',
      description: 'That upload session is no longer valid. Upload the file again.',
    };
  }
  if (c === 'session_already_consumed') {
    return {
      variant: 'info',
      title: 'Import already started',
      description: 'This file was already confirmed. Check your datasheets list.',
    };
  }
  return null;
}
