import {
  chatAiSettingsPromptFlags,
  isChatAiSettingsDebugEnabled,
} from './chat-ai-settings-debug.util';
import {
  buildSystemPrompt,
  SHORT_RESPONSE_LENGTH_MARKER,
  TINY_RESPONSE_LENGTH_MARKER,
} from './system-prompt.builder';
import { resolveChatLlmParams } from './chat-llm-params.util';
import { DEFAULT_CHAT_MAX_TOKENS } from './chat-llm-params.util';

const basePromptInput = {
  identity: { botName: 'Test Bot' },
  behavior: {
    tone: 'friendly',
    responseLength: 'medium' as const,
  },
  leadCapture: {
    enabled: false,
    requiredFields: [],
    optionalFields: [],
    collected: {},
    missingRequired: [],
    fieldLabels: {},
    shouldAskNow: false,
  },
  hasDocumentSnippets: false,
  hasAssistantHistory: false,
};

describe('isChatAiSettingsDebugEnabled', () => {
  const orig = process.env.DEBUG_CHAT_AI_SETTINGS;

  afterEach(() => {
    if (orig === undefined) delete process.env.DEBUG_CHAT_AI_SETTINGS;
    else process.env.DEBUG_CHAT_AI_SETTINGS = orig;
  });

  it('is false unless env is true', () => {
    delete process.env.DEBUG_CHAT_AI_SETTINGS;
    expect(isChatAiSettingsDebugEnabled()).toBe(false);
    process.env.DEBUG_CHAT_AI_SETTINGS = 'true';
    expect(isChatAiSettingsDebugEnabled()).toBe(true);
  });
});

describe('preview AI settings pipeline', () => {
  it('default maxTokens is 160', () => {
    const p = resolveChatLlmParams({});
    expect(p.maxTokens).toBe(DEFAULT_CHAT_MAX_TOKENS);
    expect(DEFAULT_CHAT_MAX_TOKENS).toBe(160);
    expect(p.responseLength).toBe('medium');
  });

  it('Tiny: 64 tokens uses one short line instruction', () => {
    const p = resolveChatLlmParams({ temperature: 0, maxTokens: 64, responseLength: 'short' });
    expect(p).toEqual({ temperature: 0, maxTokens: 64, responseLength: 'short' });
    const prompt = buildSystemPrompt({
      ...basePromptInput,
      behavior: { ...basePromptInput.behavior, responseLength: 'short', maxTokens: 64 },
    });
    expect(prompt).toContain(TINY_RESPONSE_LENGTH_MARKER);
    expect(chatAiSettingsPromptFlags(prompt).systemPromptContainsShortInstruction).toBe(true);
  });

  it('Short: 96 tokens uses concise sentence instruction', () => {
    const prompt = buildSystemPrompt({
      ...basePromptInput,
      behavior: { ...basePromptInput.behavior, responseLength: 'short', maxTokens: 96 },
    });
    expect(prompt).toContain(SHORT_RESPONSE_LENGTH_MARKER);
    expect(prompt).not.toContain(TINY_RESPONSE_LENGTH_MARKER);
  });

  it('Complete: 512 tokens and long enum', () => {
    const p = resolveChatLlmParams({ temperature: 1, maxTokens: 512, responseLength: 'long' });
    expect(p).toEqual({ temperature: 1, maxTokens: 512, responseLength: 'long' });
    const prompt = buildSystemPrompt({
      ...basePromptInput,
      behavior: { ...basePromptInput.behavior, responseLength: 'long', maxTokens: 512 },
    });
    expect(chatAiSettingsPromptFlags(prompt).systemPromptContainsLongInstruction).toBe(true);
  });
});
