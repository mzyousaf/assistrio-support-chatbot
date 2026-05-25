import { describe, expect, it, vi } from 'vitest';
import { toastIfPreviewAccessDenied } from './toastIfPreviewAccessDenied';
import { WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE } from './botsListMessages';

vi.mock('./app-toast', () => ({
  appToast: { error: vi.fn() },
}));

import { appToast } from './app-toast';

describe('toastIfPreviewAccessDenied', () => {
  it('returns false for ok responses', () => {
    expect(toastIfPreviewAccessDenied({ ok: true })).toBe(false);
  });

  it('shows preview denied toast for workspace_bot_preview_access_denied', () => {
    expect(
      toastIfPreviewAccessDenied({ ok: false, errorCode: 'workspace_bot_preview_access_denied' }),
    ).toBe(true);
    expect(appToast.error).toHaveBeenCalledWith(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE);
  });
});
