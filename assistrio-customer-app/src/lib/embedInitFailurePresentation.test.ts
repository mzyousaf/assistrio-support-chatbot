import { describe, expect, it } from 'vitest';
import { resolveEmbedInitFailurePresentation } from '../../../chat-widget/src/lib/embedInitFailurePresentation';
import { WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE } from '@/lib/botsListMessages';

describe('resolveEmbedInitFailurePresentation', () => {
  it('maps workspace_bot_preview_access_denied to preview denied copy', () => {
    const result = resolveEmbedInitFailurePresentation(
      `${WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE} (workspace_bot_preview_access_denied)`,
    );
    expect(result.title).toBe('Preview access denied');
    expect(result.description).toBe(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE);
    expect(result.icon).toBe('forbidden');
  });

  it('does not treat PREVIEW_FORBIDDEN as origin blocked', () => {
    const result = resolveEmbedInitFailurePresentation(
      'Preview is only available to the bot owner. Sign in as the account that owns this agent. (PREVIEW_FORBIDDEN)',
    );
    expect(result.title).toBe('Preview not available');
    expect(result.title).not.toBe('This chatbot is not allowed on this site');
  });

  it('still maps origin errors to site-not-allowed copy', () => {
    const result = resolveEmbedInitFailurePresentation('PREVIEW_ORIGIN_NOT_ALLOWED');
    expect(result.title).toBe('This chatbot is not allowed on this site');
  });
});
