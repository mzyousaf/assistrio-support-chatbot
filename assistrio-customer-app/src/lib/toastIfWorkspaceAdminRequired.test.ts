import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOT_WORKSPACE_ADMIN_ONLY_MANAGE_TOAST } from './botsListMessages';
import { toastIfWorkspaceAdminRequired } from './toastIfWorkspaceAdminRequired';

const mockToastError = vi.fn();

vi.mock('./app-toast', () => ({
  appToast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('toastIfWorkspaceAdminRequired', () => {
  afterEach(() => {
    mockToastError.mockClear();
  });

  it('returns false and does not toast for successful responses', () => {
    expect(toastIfWorkspaceAdminRequired({ ok: true })).toBe(false);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('toasts admin-only message for workspace_admin_required', () => {
    expect(
      toastIfWorkspaceAdminRequired({ ok: false, errorCode: 'workspace_admin_required' }),
    ).toBe(true);
    expect(mockToastError).toHaveBeenCalledWith(BOT_WORKSPACE_ADMIN_ONLY_MANAGE_TOAST);
  });
});
