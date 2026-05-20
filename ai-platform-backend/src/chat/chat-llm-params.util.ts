/** Default creativity when bot.config.temperature is unset. */
export const DEFAULT_CHAT_TEMPERATURE = 0.3;

import {
  DEFAULT_CHAT_MAX_TOKENS_PRESET,
  maxTokensPresetToResponseLength,
  responseLengthEnumToMaxTokens,
  snapMaxTokensToPreset,
} from './response-length-presets.util';

export {
  DEFAULT_CHAT_MAX_TOKENS_PRESET as DEFAULT_CHAT_MAX_TOKENS,
  RESPONSE_LENGTH_PRESET_MAX_TOKENS,
  type ResponseLengthPresetMaxTokens,
  maxTokensPresetToResponseLength,
  responseLengthEnumToMaxTokens,
  snapMaxTokensToPreset,
} from './response-length-presets.util';

const DEFAULT_CHAT_MAX_TOKENS = DEFAULT_CHAT_MAX_TOKENS_PRESET;

/**
 * Reserve tokens for JSON keys/language so max_tokens is not consumed entirely by the visible answer.
 * (OpenAI counts the whole completion toward max_tokens, not just assistantReplyText.)
 */
export const COMPLETION_JSON_TOKEN_OVERHEAD = 48;

/** max_tokens passed to chat.completions.create (answer budget + JSON wrapper headroom). */
export function resolveCompletionMaxTokens(answerMaxTokens: number): number {
  const base = Math.max(64, answerMaxTokens);
  return Math.min(2048, base + COMPLETION_JSON_TOKEN_OVERHEAD);
}

export function resolveChatLlmParams(
  config?: { temperature?: number; maxTokens?: number; responseLength?: string } | null,
): { temperature: number; maxTokens: number; responseLength: string } {
  const cfg = config ?? {};
  const maxTokens =
    typeof cfg.maxTokens === 'number' && Number.isFinite(cfg.maxTokens)
      ? snapMaxTokensToPreset(cfg.maxTokens)
      : typeof cfg.responseLength === 'string'
        ? responseLengthEnumToMaxTokens(cfg.responseLength)
        : DEFAULT_CHAT_MAX_TOKENS;
  return {
    temperature: typeof cfg.temperature === 'number' ? cfg.temperature : DEFAULT_CHAT_TEMPERATURE,
    maxTokens,
    responseLength: maxTokensPresetToResponseLength(maxTokens),
  };
}
