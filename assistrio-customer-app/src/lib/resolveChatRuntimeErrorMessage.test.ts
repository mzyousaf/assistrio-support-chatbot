import { describe, expect, it } from 'vitest';
import { resolveChatRuntimeErrorMessage } from './resolveChatRuntimeErrorMessage';
import { WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE } from './botsListMessages';

describe('resolveChatRuntimeErrorMessage', () => {
  it('returns preview denied copy for workspace_bot_preview_access_denied', () => {
    expect(
      resolveChatRuntimeErrorMessage({
        ok: false,
        errorCode: 'workspace_bot_preview_access_denied',
      }),
    ).toBe(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE);
  });

  it('prefers server error text when present', () => {
    expect(
      resolveChatRuntimeErrorMessage({
        ok: false,
        errorCode: 'workspace_bot_preview_access_denied',
        error: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
      }),
    ).toBe(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE);
  });

  it('falls back for generic failures', () => {
    expect(resolveChatRuntimeErrorMessage({ ok: false, error: 'Network error' })).toBe('Network error');
  });
});
