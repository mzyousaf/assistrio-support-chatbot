import { chatLog } from './chat-logger';

/** When `DEBUG_CHAT_AI_SETTINGS=true`, emit structured logs for preview/playground AI tuning. */
export function isChatAiSettingsDebugEnabled(): boolean {
  return process.env.DEBUG_CHAT_AI_SETTINGS?.trim().toLowerCase() === 'true';
}

import {
  COMPLETE_RESPONSE_LENGTH_MARKER,
  SHORT_RESPONSE_LENGTH_MARKER,
  TINY_RESPONSE_LENGTH_MARKER,
} from './system-prompt.builder';

/** @deprecated Use tier-specific markers; kept for debug log compatibility. */
export const SHORT_RESPONSE_LENGTH_MARKER_LEGACY = SHORT_RESPONSE_LENGTH_MARKER;
export const LONG_RESPONSE_LENGTH_MARKER = COMPLETE_RESPONSE_LENGTH_MARKER;

export function chatAiSettingsPromptFlags(systemPrompt: string): {
  systemPromptContainsShortInstruction: boolean;
  systemPromptContainsLongInstruction: boolean;
} {
  return {
    systemPromptContainsShortInstruction:
      systemPrompt.includes(TINY_RESPONSE_LENGTH_MARKER) ||
      systemPrompt.includes(SHORT_RESPONSE_LENGTH_MARKER),
    systemPromptContainsLongInstruction: systemPrompt.includes(COMPLETE_RESPONSE_LENGTH_MARKER),
  };
}

export type ChatAiSettingsPreCompletionLog = {
  botId: string;
  conversationId?: string;
  temperature: number;
  maxTokens: number;
  responseLength?: string;
  model: string;
  systemPromptContainsShortInstruction: boolean;
  systemPromptContainsLongInstruction: boolean;
  sessionSource?: string;
};

export type ChatAiSettingsPostCompletionLog = {
  botId: string;
  conversationId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ChatAiSettingsPreviewMergedConfigLog = {
  botId: string;
  previewOverridesConfig?: Record<string, unknown>;
  mergedConfig?: Record<string, unknown>;
  resolvedTemperature: number;
  resolvedMaxTokens: number;
  resolvedResponseLength: string;
};

export function logChatAiSettingsPreCompletion(payload: ChatAiSettingsPreCompletionLog): void {
  if (!isChatAiSettingsDebugEnabled()) return;
  chatLog({
    event: 'chat_ai_settings_pre_completion',
    level: 'info',
    botId: payload.botId,
    conversationId: payload.conversationId,
    metadata: {
      temperature: payload.temperature,
      maxTokens: payload.maxTokens,
      responseLength: payload.responseLength,
      model: payload.model,
      systemPromptContainsShortInstruction: payload.systemPromptContainsShortInstruction,
      systemPromptContainsLongInstruction: payload.systemPromptContainsLongInstruction,
      sessionSource: payload.sessionSource,
    },
  });
}

export function logChatAiSettingsPostCompletion(payload: ChatAiSettingsPostCompletionLog): void {
  if (!isChatAiSettingsDebugEnabled()) return;
  chatLog({
    event: 'chat_ai_settings_post_completion',
    level: 'info',
    botId: payload.botId,
    conversationId: payload.conversationId,
    metadata: {
      promptTokens: payload.promptTokens,
      completionTokens: payload.completionTokens,
      totalTokens: payload.totalTokens,
    },
  });
}

export function logChatAiSettingsPreviewMergedConfig(payload: ChatAiSettingsPreviewMergedConfigLog): void {
  if (!isChatAiSettingsDebugEnabled()) return;
  chatLog({
    event: 'chat_ai_settings_preview_merged_config',
    level: 'info',
    botId: payload.botId,
    metadata: {
      previewOverridesConfig: payload.previewOverridesConfig,
      mergedConfig: payload.mergedConfig,
      resolvedTemperature: payload.resolvedTemperature,
      resolvedMaxTokens: payload.resolvedMaxTokens,
      resolvedResponseLength: payload.resolvedResponseLength,
    },
  });
}
