/**
 * Mirrors `WidgetPreviewController.buildPreviewBotLike` config merge for preview chat.
 */

function mergePlainRecords(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    const prev = out[key];
    if (
      prev !== null &&
      typeof prev === 'object' &&
      !Array.isArray(prev) &&
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      out[key] = mergePlainRecords(prev as Record<string, unknown>, val as Record<string, unknown>);
      continue;
    }
    out[key] = val;
  }
  return out;
}

function mergePreviewConfig(
  botConfig: Record<string, unknown> | undefined,
  previewConfig: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (botConfig && previewConfig) {
    return mergePlainRecords(botConfig, previewConfig);
  }
  return previewConfig ?? botConfig;
}

import { resolveChatLlmParams, DEFAULT_CHAT_MAX_TOKENS } from './chat-llm-params.util';

describe('widget preview config merge', () => {
  const savedBotConfig = { temperature: 0.3, maxTokens: 160, responseLength: 'medium' };

  it('default fallback uses 160 tokens', () => {
    const p = resolveChatLlmParams({});
    expect(p.maxTokens).toBe(DEFAULT_CHAT_MAX_TOKENS);
    expect(DEFAULT_CHAT_MAX_TOKENS).toBe(160);
  });

  it('Tiny preview overrides win', () => {
    const merged = mergePreviewConfig(savedBotConfig, {
      temperature: 0,
      maxTokens: 96,
      responseLength: 'short',
    });
    const p = resolveChatLlmParams(merged);
    expect(p).toEqual({ temperature: 0, maxTokens: 96, responseLength: 'short' });
  });

  it('Complete preview overrides win', () => {
    const merged = mergePreviewConfig(savedBotConfig, {
      temperature: 1,
      maxTokens: 512,
      responseLength: 'long',
    });
    const p = resolveChatLlmParams(merged);
    expect(p).toEqual({ temperature: 1, maxTokens: 512, responseLength: 'long' });
  });

  it('preview config merge overrides responseStyleInstructions', () => {
    const merged = mergePreviewConfig(savedBotConfig, {
      responseStyleInstructions: 'Use short bullet points.',
    });
    expect(merged?.responseStyleInstructions).toBe('Use short bullet points.');
  });

  it('preview config merge overrides structured response style fields', () => {
    const merged = mergePreviewConfig(savedBotConfig, {
      responseStyleMode: 'structured',
      responseStyleDescription: 'Title and answer',
      responseStyleInstructions: 'Title: <short title>\nAnswer: <answer>',
    });
    expect(merged?.responseStyleMode).toBe('structured');
    expect(merged?.responseStyleDescription).toBe('Title and answer');
    expect(merged?.responseStyleInstructions).toContain('Title:');
  });

  it('preview config merge nulls clear saved response style', () => {
    const withStyle = {
      ...savedBotConfig,
      responseStyleMode: 'structured',
      responseStyleInstructions: 'Old locked format',
    };
    const merged = mergePreviewConfig(withStyle, {
      responseStyleMode: null,
      responseStyleDescription: null,
      responseStyleInstructions: null,
      responseStyleRefinedAt: null,
    });
    expect(merged?.responseStyleInstructions).toBeNull();
    expect(merged?.responseStyleMode).toBeNull();
  });

  it('missing previewOverrides.config falls back to saved bot', () => {
    const p = resolveChatLlmParams(savedBotConfig);
    expect(p.temperature).toBe(0.3);
    expect(p.maxTokens).toBe(160);
    expect(p.responseLength).toBe('medium');
  });
});
