import type { ApiResult } from './types';

/**
 * True when a document DELETE (or similar remove call) should clear local UI:
 * normal success, 404, or common “already gone” error bodies.
 * Does not apply to PATCH bot payloads (a 404 there may mean the bot was deleted).
 */
export function adminDocumentDeleteResolved(res: ApiResult<unknown>): boolean {
  if (res.ok) return true;
  if (res.status === 404 || res.status === 410) return true;
  const msg = (res.error ?? '').toLowerCase();
  if (msg.includes('not found')) return true;
  if (msg.includes('already deleted')) return true;
  return false;
}
