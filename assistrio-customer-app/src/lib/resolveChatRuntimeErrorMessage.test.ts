import { describe, expect, it } from 'vitest';
import {
  AI_CREDITS_USAGE_UNAVAILABLE_CODE,
  AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE,
  PLAN_LIMIT_AI_CREDITS_CODE,
  PLAN_LIMIT_AI_CREDITS_MESSAGE,
  resolveChatRuntimeErrorMessage,
} from './resolveChatRuntimeErrorMessage';
import { WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE } from './botsListMessages';
import { WORKSPACE_BOT_LIMIT_EXCEEDED_CODE, WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE } from './planLimitError';

describe('resolveChatRuntimeErrorMessage', () => {
  it('maps plan_limit_ai_credits to friendly copy', () => {
    expect(
      resolveChatRuntimeErrorMessage({
        ok: false,
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
        error: 'Your workspace has used all AI credits for this billing period.',
      }),
    ).toBe(PLAN_LIMIT_AI_CREDITS_MESSAGE);
  });

  it('maps ai_credits_usage_unavailable to friendly copy', () => {
    expect(
      resolveChatRuntimeErrorMessage({
        ok: false,
        errorCode: AI_CREDITS_USAGE_UNAVAILABLE_CODE,
        error: 'Unable to verify AI credit usage. Please try again shortly.',
      }),
    ).toBe(AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE);
  });

  it('returns preview denied copy for workspace_bot_preview_access_denied', () => {
    expect(
      resolveChatRuntimeErrorMessage({
        ok: false,
        errorCode: 'workspace_bot_preview_access_denied',
      }),
    ).toBe(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE);
  });

  it('returns over-limit locked copy for workspace_bot_limit_exceeded', () => {
    expect(
      resolveChatRuntimeErrorMessage({
        ok: false,
        errorCode: WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
      }),
    ).toBe(WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE);
  });

  it('prefers mapped credit copy over raw backend message', () => {
    expect(
      resolveChatRuntimeErrorMessage({
        ok: false,
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
        error: 'Your workspace has used all AI credits for this billing period.',
      }),
    ).toBe(PLAN_LIMIT_AI_CREDITS_MESSAGE);
  });

  it('falls back for generic failures', () => {
    expect(resolveChatRuntimeErrorMessage({ ok: false, error: 'Network error' })).toBe('Network error');
  });
});
