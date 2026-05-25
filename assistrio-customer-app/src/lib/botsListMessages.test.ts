import { describe, expect, it } from 'vitest';
import { isCreateDraftAdminDenied, isWorkspaceAdminRequired } from './botsListMessages';

describe('isCreateDraftAdminDenied', () => {
  it('detects workspace_access_denied', () => {
    expect(isCreateDraftAdminDenied({ ok: false, errorCode: 'workspace_access_denied' })).toBe(true);
  });

  it('detects workspace_admin_required', () => {
    expect(isWorkspaceAdminRequired({ ok: false, errorCode: 'workspace_admin_required' })).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isCreateDraftAdminDenied({ ok: false, errorCode: 'plan_limit' })).toBe(false);
    expect(isCreateDraftAdminDenied({ ok: true })).toBe(false);
  });
});
