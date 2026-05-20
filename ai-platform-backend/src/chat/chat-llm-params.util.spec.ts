import {
  COMPLETION_JSON_TOKEN_OVERHEAD,
  DEFAULT_CHAT_MAX_TOKENS,
  DEFAULT_CHAT_TEMPERATURE,
  maxTokensPresetToResponseLength,
  resolveChatLlmParams,
  resolveCompletionMaxTokens,
  snapMaxTokensToPreset,
} from './chat-llm-params.util';

describe('resolveCompletionMaxTokens', () => {
  it('adds JSON wrapper headroom to the configured answer budget', () => {
    expect(resolveCompletionMaxTokens(160)).toBe(160 + COMPLETION_JSON_TOKEN_OVERHEAD);
    expect(resolveCompletionMaxTokens(64)).toBe(64 + COMPLETION_JSON_TOKEN_OVERHEAD);
  });
});

describe('snapMaxTokensToPreset', () => {
  it('snaps 288 to 256 Detailed', () => {
    expect(snapMaxTokensToPreset(288)).toBe(256);
  });

  it('maps presets to responseLength enum', () => {
    expect(maxTokensPresetToResponseLength(64)).toBe('short');
    expect(maxTokensPresetToResponseLength(96)).toBe('short');
    expect(maxTokensPresetToResponseLength(160)).toBe('medium');
    expect(maxTokensPresetToResponseLength(256)).toBe('long');
    expect(maxTokensPresetToResponseLength(512)).toBe('long');
  });
});

describe('resolveChatLlmParams', () => {
  it('uses bot config temperature and snaps maxTokens; responseLength follows preset', () => {
    const p = resolveChatLlmParams({ temperature: 0.7, maxTokens: 160, responseLength: 'short' });
    expect(p.temperature).toBe(0.7);
    expect(p.maxTokens).toBe(160);
    expect(p.responseLength).toBe('medium');
  });

  it('snaps stray maxTokens (288) and sets long responseLength', () => {
    const p = resolveChatLlmParams({ maxTokens: 288, responseLength: 'medium' });
    expect(p.maxTokens).toBe(256);
    expect(p.responseLength).toBe('long');
  });

  it('maps 80 to short and 128 to medium at runtime', () => {
    expect(resolveChatLlmParams({ maxTokens: 80 }).responseLength).toBe('short');
    expect(resolveChatLlmParams({ maxTokens: 128 }).responseLength).toBe('medium');
    expect(resolveChatLlmParams({ maxTokens: 208 }).responseLength).toBe('long');
  });

  it('returns temperature 0 and 1 unchanged', () => {
    expect(resolveChatLlmParams({ temperature: 0 }).temperature).toBe(0);
    expect(resolveChatLlmParams({ temperature: 1 }).temperature).toBe(1);
  });

  it('falls back to aligned defaults when config fields are missing', () => {
    const p = resolveChatLlmParams({});
    expect(p.temperature).toBe(DEFAULT_CHAT_TEMPERATURE);
    expect(p.maxTokens).toBe(DEFAULT_CHAT_MAX_TOKENS);
    expect(p.responseLength).toBe('medium');
  });
});
