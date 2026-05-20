/** Shared response-length preset caps (customer UI + API normalization). */
export const RESPONSE_LENGTH_PRESET_MAX_TOKENS = [64, 80, 96, 128, 160, 208, 256, 384, 512] as const;

export type ResponseLengthPresetMaxTokens = (typeof RESPONSE_LENGTH_PRESET_MAX_TOKENS)[number];

export const DEFAULT_CHAT_MAX_TOKENS_PRESET: ResponseLengthPresetMaxTokens = 160;

/** Snap arbitrary maxTokens to the nearest allowed preset (e.g. 288 → 256). */
export function snapMaxTokensToPreset(raw: number): ResponseLengthPresetMaxTokens {
  if (!Number.isFinite(raw)) return DEFAULT_CHAT_MAX_TOKENS_PRESET;
  const n = Math.floor(raw);
  let best: ResponseLengthPresetMaxTokens = RESPONSE_LENGTH_PRESET_MAX_TOKENS[0];
  let bestDist = Math.abs(n - best);
  for (let i = 1; i < RESPONSE_LENGTH_PRESET_MAX_TOKENS.length; i++) {
    const preset = RESPONSE_LENGTH_PRESET_MAX_TOKENS[i];
    const dist = Math.abs(n - preset);
    if (dist < bestDist || (dist === bestDist && preset < best)) {
      best = preset;
      bestDist = dist;
    }
  }
  return best;
}

/** Map snapped preset maxTokens to stored responseLength enum. */
export function maxTokensPresetToResponseLength(
  maxTokens: number,
): 'short' | 'medium' | 'long' {
  const mt = snapMaxTokensToPreset(maxTokens);
  if (mt <= 96) return 'short';
  if (mt <= 160) return 'medium';
  return 'long';
}

/** Map responseLength enum to default preset when maxTokens is omitted. */
export function responseLengthEnumToMaxTokens(rl: string): ResponseLengthPresetMaxTokens {
  if (rl === 'short') return 96;
  if (rl === 'long') return 512;
  return 160;
}
