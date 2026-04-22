/**
 * Response language and AI tuning options for the customer “AI & Responses” workspace.
 * Response language list: full ISO 639-1 set (see `responseLanguageOptions.ts`).
 */

import { RESPONSE_LANGUAGE_OPTIONS } from './responseLanguageOptions';

export { RESPONSE_LANGUAGE_OPTIONS };

/** Paragraphs for the Creativity range info tooltip (shown beside the label). */
export const CREATIVITY_TOOLTIP_LINES = [
  'This control maps to “temperature”: how much randomness the model uses when choosing words and phrasing.',
  'Lower values keep answers more consistent and predictable—good for policies, FAQs, and scripted support. Higher values allow more varied wording and exploration.',
  'Presets: Focused stays close to deterministic replies; Balanced is recommended for most assistants; Creative allows more expressive, varied responses.',
] as const;

/** Paragraphs for the Response length range info tooltip. */
export const RESPONSE_LENGTH_TOOLTIP_LINES = [
  'This sets a soft upper limit on how long each reply can be (shown in tokens—the model’s unit of text).',
  'Short works well for confirmations and quick facts. Standard fits most everyday chats. Detailed gives room for step-by-step help and longer explanations.',
  'The assistant may still answer briefly when a short reply is enough; the limit is a cap, not a target.',
] as const;

/** Creativity (temperature): slider markers — values are 0–1. */
export const CREATIVITY_MARKER_VALUES = [0.2, 0.5, 0.8] as const;
export const CREATIVITY_MARKER_LABELS = ['Focused', 'Balanced', 'Creative'] as const;

/** Response length (max tokens): slider bounds and preset markers. */
export const MAX_TOKENS_MIN = 256;
export const MAX_TOKENS_MAX = 1024;
export const MAX_TOKENS_STEP = 32;
export const LENGTH_MARKER_TOKENS = [320, 512, 896] as const;
export const LENGTH_MARKER_LABELS = ['Short', 'Standard', 'Detailed'] as const;

export function normalizeLanguageSelectValue(raw: unknown): string {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t || t.toLowerCase() === 'auto') return 'auto';
  const known = RESPONSE_LANGUAGE_OPTIONS.some((o) => o.value === t);
  if (known) return t;
  return `__custom:${t}`;
}

export function languageForPayload(selectValue: string): string {
  if (selectValue === 'auto') return 'auto';
  if (selectValue.startsWith('__custom:')) return selectValue.slice('__custom:'.length);
  return selectValue;
}

export function maxTokensToResponseLength(n: number): 'short' | 'medium' | 'long' {
  if (n <= 416) return 'short';
  if (n <= 704) return 'medium';
  return 'long';
}

export function clampCreativity(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function snapMaxTokens(n: number): number {
  const s = MAX_TOKENS_STEP;
  const stepped = Math.round(n / s) * s;
  return Math.min(MAX_TOKENS_MAX, Math.max(MAX_TOKENS_MIN, stepped));
}
