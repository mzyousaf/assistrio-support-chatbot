/**

 * Response language and AI tuning options for the customer “AI & Advanced” workspace.

 * Response language list: full ISO 639-1 set (see `responseLanguageOptions.ts`).

 */



import { BOT_FIELD_MAX, clampStr } from '@/lib/botFieldLimits';

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

  'Nine snap points from Tiny through Complete; main labels mark the core presets, with + steps between them.',

  'The assistant may still answer briefly when a short reply is enough; the limit is a cap, not a target.',

] as const;



/** Creativity (temperature): slider bounds and markers (maps to OpenAI temperature). */

export const CREATIVITY_MIN = 0;

export const CREATIVITY_MAX = 1;

export const CREATIVITY_STEP = 0.05;

export const CREATIVITY_MARKER_VALUES = [0.2, 0.5, 0.8] as const;

export const CREATIVITY_MARKER_LABELS = ['Focused', 'Balanced', 'Creative'] as const;

/** Label row positions along the creativity track (0 = start, 1 = end). */
export const CREATIVITY_MARKER_POSITIONS = [0, 0.5, 1] as const;



/** All allowed response-length snap points (slider indices 0–8). */

export const RESPONSE_LENGTH_ALL_PRESET_TOKENS = [

  64, 80, 96, 128, 160, 208, 256, 384, 512,

] as const;



/** Full label for the active snap point (Tiny, Tiny+, …, Complete). */

export const RESPONSE_LENGTH_PRESET_LABELS = [

  'Tiny',

  'Tiny+',

  'Short',

  'Short+',

  'Standard',

  'Standard+',

  'Detailed',

  'Detailed+',

  'Complete',

] as const;



/** Main track labels only (click jumps to core preset). */

export const LENGTH_PRIMARY_MARKER_TOKENS = [64, 96, 160, 256, 512] as const;

export const LENGTH_PRIMARY_MARKER_LABELS = [

  'Tiny',

  'Short',

  'Standard',

  'Detailed',

  'Complete',

] as const;

/** Label row positions for primary length presets (slider indices 0, 2, 4, 6, 8). */
export const LENGTH_PRIMARY_MARKER_POSITIONS = [0, 2, 4, 6, 8].map(
  (idx) => idx / (RESPONSE_LENGTH_ALL_PRESET_TOKENS.length - 1),
) as [number, number, number, number, number];



/** @deprecated Use RESPONSE_LENGTH_ALL_PRESET_TOKENS — alias for snap/index helpers. */

export const LENGTH_MARKER_TOKENS = RESPONSE_LENGTH_ALL_PRESET_TOKENS;

/** @deprecated Use RESPONSE_LENGTH_PRESET_LABELS for active label. */

export const LENGTH_MARKER_LABELS = LENGTH_PRIMARY_MARKER_LABELS;



export const RESPONSE_LENGTH_PRESET_TOKENS = {

  tiny: 64,

  tinyPlus: 80,

  short: 96,

  shortPlus: 128,

  standard: 160,

  standardPlus: 208,

  detailed: 256,

  detailedPlus: 384,

  complete: 512,

} as const;



export const MAX_TOKENS_MIN = RESPONSE_LENGTH_ALL_PRESET_TOKENS[0];

export const MAX_TOKENS_MAX = RESPONSE_LENGTH_ALL_PRESET_TOKENS[8];

export const RESPONSE_LENGTH_PRESET_COUNT = RESPONSE_LENGTH_ALL_PRESET_TOKENS.length;



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



/**

 * Map snapped token cap to backend `responseLength` enum (short | medium | long).

 * 64/80/96 → short; 128/160 → medium; 208+ → long.

 */

export function maxTokensToResponseLength(n: number): 'short' | 'medium' | 'long' {

  const mt = snapMaxTokens(n);

  if (mt <= 96) return 'short';

  if (mt <= 160) return 'medium';

  return 'long';

}



/** Preset max output tokens for onboarding / enum response length. */

export function responseLengthToMaxTokens(rl: string): number {

  if (rl === 'short') return RESPONSE_LENGTH_PRESET_TOKENS.short;

  if (rl === 'long') return RESPONSE_LENGTH_PRESET_TOKENS.complete;

  return RESPONSE_LENGTH_PRESET_TOKENS.standard;

}



export function clampCreativity(n: number): number {

  return Math.min(1, Math.max(0, n));

}



/** Snap to nearest allowed preset (e.g. 288 → 256). */

export function snapMaxTokens(n: number): number {

  if (!Number.isFinite(n)) return RESPONSE_LENGTH_PRESET_TOKENS.standard;

  const value = Math.floor(n);

  let best: number = RESPONSE_LENGTH_ALL_PRESET_TOKENS[0];

  let bestDist = Math.abs(value - best);

  for (let i = 1; i < RESPONSE_LENGTH_ALL_PRESET_TOKENS.length; i++) {

    const preset = RESPONSE_LENGTH_ALL_PRESET_TOKENS[i];

    const dist = Math.abs(value - preset);

    if (dist < bestDist || (dist === bestDist && preset < best)) {

      best = preset;

      bestDist = dist;

    }

  }

  return best;

}



export function isAllowedMaxTokensPreset(n: number): boolean {

  const snapped = snapMaxTokens(n);

  return RESPONSE_LENGTH_ALL_PRESET_TOKENS.includes(

    snapped as (typeof RESPONSE_LENGTH_ALL_PRESET_TOKENS)[number],

  );

}



export function maxTokensToPresetIndex(n: number): number {

  const mt = snapMaxTokens(n);

  const idx = RESPONSE_LENGTH_ALL_PRESET_TOKENS.indexOf(

    mt as (typeof RESPONSE_LENGTH_ALL_PRESET_TOKENS)[number],

  );

  return idx >= 0 ? idx : 4;

}



export function presetIndexToMaxTokens(index: number): number {

  const i = Math.min(RESPONSE_LENGTH_ALL_PRESET_TOKENS.length - 1, Math.max(0, Math.round(index)));

  return RESPONSE_LENGTH_ALL_PRESET_TOKENS[i];

}



/** Which primary marker group (0–4) is active for the snapped value. */

export function primaryPresetGroupIndex(maxTokens: number): number {

  const mt = snapMaxTokens(maxTokens);

  if (mt <= 80) return 0;

  if (mt <= 128) return 1;

  if (mt <= 208) return 2;

  if (mt <= 384) return 3;

  return 4;

}



export const CREATIVITY_RECOMMENDED = 0.5;

export const RESPONSE_LENGTH_RECOMMENDED_TOKENS = RESPONSE_LENGTH_PRESET_TOKENS.short;



export function creativityModeLabel(temperature: number): string {

  const t = clampCreativity(temperature);

  if (t >= 0.95) return 'Maximum creativity';

  if (t >= 0.65) return 'Creative';

  if (t >= 0.35) return 'Balanced';

  if (t <= 0.05) return 'Maximum focus';

  return 'Focused';

}



export type AnswerMode = 'knowledge_first' | 'knowledge_only';



export const ANSWER_MODE_OPTIONS: {
  value: AnswerMode;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    value: 'knowledge_first',
    label: 'Knowledge first',
    description:
      'Answer from your knowledge base when relevant. Can help with safe general or creative tasks related to your business.',
    recommended: true,
  },
  {
    value: 'knowledge_only',
    label: 'Knowledge only',
    description:
      'Strict mode: only answer when the knowledge base directly supports it. No invented examples, templates, or copy.',
  },
];



export function normalizeAnswerMode(raw: unknown): AnswerMode {

  return raw === 'knowledge_only' ? 'knowledge_only' : 'knowledge_first';

}



export function normalizeResponseStyleDescription(raw: string): string | undefined {

  const trimmed = String(raw ?? '').trim();

  if (!trimmed) return undefined;

  return clampStr(trimmed, BOT_FIELD_MAX.responseStyleDescription);

}



export function normalizeResponseStyleInstructions(raw: string): string | undefined {

  const trimmed = String(raw ?? '').trim();

  if (!trimmed) return undefined;

  return clampStr(trimmed, BOT_FIELD_MAX.responseStyleInstructions);

}



export function resolveStructuredResponseFormatEnabledFromConfig(

  config: Record<string, unknown> | undefined,

): boolean {

  if (config?.responseStyleMode !== 'structured') return false;

  const inst = config?.responseStyleInstructions;

  return typeof inst === 'string' && inst.trim().length > 0;

}



const RESPONSE_STYLE_CLEAR_PREVIEW_KEYS = [

  'responseStyleMode',

  'responseStyleDescription',

  'responseStyleInstructions',

  'responseStyleRefinedAt',

] as const;



export function buildResponseStylePreviewClearFields(): Record<string, null> {

  return Object.fromEntries(RESPONSE_STYLE_CLEAR_PREVIEW_KEYS.map((k) => [k, null])) as Record<

    string,

    null

  >;

}



export function responseLengthModeLabel(maxTokens: number): string {

  return RESPONSE_LENGTH_PRESET_LABELS[maxTokensToPresetIndex(maxTokens)] ?? 'Standard';

}



export function isCreativityRecommendedValue(temperature: number): boolean {

  return Math.abs(clampCreativity(temperature) - CREATIVITY_RECOMMENDED) < 0.026;

}



export function isResponseLengthRecommendedValue(maxTokens: number): boolean {

  return snapMaxTokens(maxTokens) === RESPONSE_LENGTH_RECOMMENDED_TOKENS;

}



export function buildAiIntegrationsPreviewDraftSlice(input: {

  creativity: number;

  maxTokens: number;

  answerMode: AnswerMode;

  structuredResponseFormatEnabled: boolean;

  responseStyleDescription: string;

  responseStyleInstructions: string;

  allowFileUpload: boolean;

  showMic: boolean;

  showVoice: boolean;

}) {

  const mt = snapMaxTokens(input.maxTokens);

  const style = normalizeResponseStyleInstructions(input.responseStyleInstructions);

  const desc = normalizeResponseStyleDescription(input.responseStyleDescription);

  const config: Record<string, unknown> = {

    temperature: clampCreativity(input.creativity),

    maxTokens: mt,

    responseLength: maxTokensToResponseLength(mt),

    answerMode: input.answerMode,

  };

  if (input.structuredResponseFormatEnabled && style) {

    config.responseStyleMode = 'structured';

    if (desc) config.responseStyleDescription = desc;

    config.responseStyleInstructions = style;

  } else {

    Object.assign(config, buildResponseStylePreviewClearFields());

  }

  return {

    personality: {} as Record<string, unknown>,

    config,

    chatUiAdvanced: {

      allowFileUpload: input.allowFileUpload,

      showMic: input.showMic,

      showVoice: input.showVoice,

    },

  };

}


