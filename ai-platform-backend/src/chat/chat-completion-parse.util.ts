/**
 * Parse translation-contract JSON from OpenAI chat completions with recovery paths.
 */

import type OpenAI from 'openai';

export const DEFAULT_CHAT_FALLBACK_MESSAGE =
  "I don't have enough information to answer that right now. Is there something else I can help with?";

export type TranslationCompletionFields = {
  userEnglishText: string;
  userOriginalLanguage: string;
  assistantReplyText: string;
  assistantEnglishText: string;
  assistantReplyLanguage: string;
};

export type CompletionFallbackReason =
  | 'json_parse_failed'
  | 'missing_assistant_reply_text'
  | 'empty_completion'
  | 'model_returned_fallback_despite_evidence'
  | 'completion_api_error'
  | null;

export type CompletionParseStatus =
  | 'valid_json'
  | 'recovered_json_field'
  | 'recovered_plain_text'
  | 'failed';

export type CompletionParseResult = {
  fields: TranslationCompletionFields;
  /** True when assistantReplyText was read from a fully parsed JSON object (not regex). */
  parsedJsonOk: boolean;
  parseStatus: CompletionParseStatus;
  recoveredFromRawText: boolean;
  recoveryMethod?: 'json' | 'json_embedded' | 'code_fence' | 'regex_field' | 'plain_text' | 'retry';
  fallbackReason: CompletionFallbackReason;
  rawCompletionPreview: string;
  shouldRetryCompletion: boolean;
};

export type ParseTranslationCompletionOptions = {
  fallbackMessage?: string;
  /** When true (answerability shouldUseFallback), generic refusal text is accepted. */
  allowGenericFallback: boolean;
  defaultReplyLanguage?: string;
};

function previewRaw(raw: string, max = 500): string {
  return String(raw ?? '').slice(0, max);
}

function normalizeDedupe(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Model echoed the canned insufficient-information fallback despite having evidence. */
export function isGenericRefusalText(text: string, fallbackMessage = DEFAULT_CHAT_FALLBACK_MESSAGE): boolean {
  const n = normalizeDedupe(text);
  if (!n) return false;
  const fb = normalizeDedupe(fallbackMessage);
  if (n === fb) return true;
  return (
    n.includes("don't have enough information") ||
    n.includes('do not have enough information') ||
    n.includes("couldn't find that in the available knowledge")
  );
}

function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) return fence[1].trim();
  const inner = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (inner) return inner[1].trim();
  return trimmed;
}

export function parseJsonObjectFromText(text: string): Record<string, unknown> | null {
  const raw = stripMarkdownCodeFence(String(text || '').trim());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function readStringField(obj: Record<string, unknown> | null, key: string): string {
  if (!obj) return '';
  const v = obj[key];
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v.trim() : '';
}

function extractFieldByRegex(raw: string, field: string): string {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'is'),
    new RegExp(`'${field}'\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'`, 'is'),
    new RegExp(`${field}\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'is'),
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      try {
        return JSON.parse(`"${m[1]}"`);
      } catch {
        return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
      }
    }
  }
  return '';
}

function extractFieldsFromParsed(
  parsed: Record<string, unknown> | null,
  raw: string,
): {
  fields: Partial<TranslationCompletionFields>;
  method?: CompletionParseResult['recoveryMethod'];
  parsedAssistantFromObject: boolean;
} {
  let assistantReplyText = readStringField(parsed, 'assistantReplyText');
  let assistantEnglishText = readStringField(parsed, 'assistantEnglishText');
  let method: CompletionParseResult['recoveryMethod'] | undefined = parsed ? 'json' : undefined;
  let parsedAssistantFromObject = Boolean(parsed && assistantReplyText);

  if (!assistantReplyText && !assistantEnglishText) {
    assistantReplyText = extractFieldByRegex(raw, 'assistantReplyText');
    assistantEnglishText = extractFieldByRegex(raw, 'assistantEnglishText');
    if (assistantReplyText || assistantEnglishText) {
      method = 'regex_field';
      parsedAssistantFromObject = false;
    }
  }

  return {
    method,
    parsedAssistantFromObject,
    fields: {
      userEnglishText: readStringField(parsed, 'userEnglishText'),
      userOriginalLanguage: readStringField(parsed, 'userOriginalLanguage'),
      assistantReplyText,
      assistantEnglishText,
      assistantReplyLanguage: readStringField(parsed, 'assistantReplyLanguage'),
    },
  };
}

function recoverPlainTextAnswer(raw: string): string {
  const trimmed = stripMarkdownCodeFence(raw);
  if (!trimmed || trimmed.startsWith('{')) return '';
  if (trimmed.length < 20) return '';
  return trimmed;
}

function finalizeFields(
  partial: Partial<TranslationCompletionFields>,
  opts: ParseTranslationCompletionOptions,
): TranslationCompletionFields {
  const defaultLang = opts.defaultReplyLanguage ?? 'English';
  let assistantReplyText = (partial.assistantReplyText ?? '').trim();
  let assistantEnglishText = (partial.assistantEnglishText ?? '').trim();

  if (!assistantReplyText && assistantEnglishText) assistantReplyText = assistantEnglishText;
  if (!assistantEnglishText && assistantReplyText) assistantEnglishText = assistantReplyText;

  return {
    userEnglishText: partial.userEnglishText ?? '',
    userOriginalLanguage: partial.userOriginalLanguage ?? 'en',
    assistantReplyText,
    assistantEnglishText,
    assistantReplyLanguage: partial.assistantReplyLanguage || defaultLang,
  };
}

function deriveParseStatus(input: {
  hasAnswer: boolean;
  parsedJsonOk: boolean;
  recoveryMethod?: CompletionParseResult['recoveryMethod'];
}): CompletionParseStatus {
  if (!input.hasAnswer) return 'failed';
  if (input.parsedJsonOk) return 'valid_json';
  if (input.recoveryMethod === 'plain_text') return 'recovered_plain_text';
  if (
    input.recoveryMethod === 'regex_field' ||
    input.recoveryMethod === 'json_embedded' ||
    input.recoveryMethod === 'code_fence'
  ) {
    return 'recovered_json_field';
  }
  return 'failed';
}

/**
 * Slim JSON contract: model returns only assistant fields (user transcript is filled server-side).
 */
export function buildTranslationContractSystemSuffix(
  _mode: 'english_only' | 'auto' | 'fixed' = 'english_only',
): string {
  return (
    '\n\n--- Translation contract ---\n' +
    'Return ONLY one JSON object. No prose or markdown code fence before or after the JSON.\n' +
    'Required keys: "assistantReplyText" (string), "assistantReplyLanguage" (string), "assistantEnglishText" (string or null).\n' +
    'Set assistantEnglishText to null when assistantReplyText is already in English; otherwise provide faithful English transcript.\n' +
    'Do NOT include userEnglishText, userOriginalLanguage, or duplicate the full answer in two fields when they are the same language.\n' +
    'Example: {"assistantReplyText":"Here are the main benefits:\\n\\n- Fast customer support\\n- 24/7 availability","assistantReplyLanguage":"English","assistantEnglishText":null}\n' +
    'Rules:\n' +
    '- assistantReplyText is the visitor-facing answer synthesized from evidence. Its string value must be valid Markdown (not HTML), per the formatting rules above.\n' +
    '- Default to "- " bullet lists for benefits, features, examples, and multi-item answers; use numbered lists ("1. ", "2. ", …) only for step-by-step instructions, ranked/priority lists, explicit numbered-list requests, or clear sequences ("top 5", first/second/third).\n' +
    '- Follow tier-specific heading rules in the Response length section (no ## headings on Tiny/Short/Standard).\n' +
    '- Do not put inline citation markers ([1], [source:1], footnotes) in assistantReplyText; sources are shown separately by the app.\n' +
    '- If mode is english_only: reply in English; set assistantEnglishText to null.\n' +
    '- If mode is auto: assistantReplyText matches the user language; set assistantEnglishText when not English.\n' +
    '- If mode is fixed: assistantReplyText is in the fixed language; set assistantEnglishText when not English.\n' +
    '- Never leave assistantReplyText empty when you can answer from evidence.\n' +
    '- Do not return a refusal unless the evidence truly cannot support any answer.'
  );
}

/** Strict JSON schema for gpt-4.1+ structured outputs (all properties required under strict mode). */
export function buildTranslationResponseFormat(): OpenAI.Chat.ChatCompletionCreateParams['response_format'] {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'chat_translation_completion',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          assistantReplyText: { type: 'string' },
          assistantReplyLanguage: { type: 'string' },
          assistantEnglishText: { type: ['string', 'null'] },
        },
        required: ['assistantReplyText', 'assistantReplyLanguage', 'assistantEnglishText'],
      },
    },
  };
}

export function buildTranslationJsonObjectResponseFormat(): OpenAI.Chat.ChatCompletionCreateParams['response_format'] {
  return { type: 'json_object' };
}

/** OpenAI 400 when json_schema is rejected (e.g. strict mode / optional field mismatch). */
export function isResponseFormatSchemaInvalidError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: number }).status;
  if (status !== 400) return false;
  const message = String((error as Error).message ?? '').toLowerCase();
  return (
    message.includes('invalid schema') ||
    message.includes('response_format') ||
    message.includes('json_schema')
  );
}

/**
 * Try json_schema first; on schema rejection retry once with json_object.
 */
export async function createTranslationCompletionWithFormatFallback(
  createWithFormat: (
    responseFormat: OpenAI.Chat.ChatCompletionCreateParams['response_format'],
  ) => Promise<OpenAI.Chat.Completions.ChatCompletion>,
): Promise<{
  completion: OpenAI.Chat.Completions.ChatCompletion;
  usedJsonObjectFallback: boolean;
}> {
  try {
    const completion = await createWithFormat(buildTranslationResponseFormat());
    return { completion, usedJsonObjectFallback: false };
  } catch (error) {
    if (!isResponseFormatSchemaInvalidError(error)) throw error;
    const completion = await createWithFormat(buildTranslationJsonObjectResponseFormat());
    return { completion, usedJsonObjectFallback: true };
  }
}

export const COMPLETION_JSON_RETRY_USER_APPENDIX =
  'Your previous response was invalid or incomplete. Return ONLY valid JSON with keys assistantReplyText, assistantReplyLanguage (non-empty strings), and assistantEnglishText (string or null). The assistantReplyText value must be Markdown (not HTML): default "- " bullets; numbered lists only for steps/ranking/numbered-list requests. No extra keys, no prose outside JSON.';

/**
 * Parse raw completion into translation fields with layered recovery.
 */
export function parseTranslationCompletion(
  rawModel: string,
  opts: ParseTranslationCompletionOptions,
): CompletionParseResult {
  const fallbackMessage = opts.fallbackMessage ?? DEFAULT_CHAT_FALLBACK_MESSAGE;
  const raw = String(rawModel ?? '').trim();
  const rawCompletionPreview = previewRaw(raw);

  if (!raw) {
    return {
      fields: finalizeFields({}, opts),
      parsedJsonOk: false,
      parseStatus: 'failed',
      recoveredFromRawText: false,
      fallbackReason: 'empty_completion',
      rawCompletionPreview,
      shouldRetryCompletion: !opts.allowGenericFallback,
    };
  }

  const fenced = stripMarkdownCodeFence(raw);
  const parsed = parseJsonObjectFromText(raw);
  const parsedFromFence = !parsed && fenced !== raw ? parseJsonObjectFromText(fenced) : null;
  const effectiveParsed = parsed ?? parsedFromFence;
  let recoveryMethod: CompletionParseResult['recoveryMethod'] = parsed
    ? 'json'
    : parsedFromFence
      ? 'code_fence'
      : effectiveParsed
        ? 'json_embedded'
        : undefined;

  const { fields: partial, method: extractMethod, parsedAssistantFromObject } =
    extractFieldsFromParsed(effectiveParsed, raw);
  if (extractMethod) recoveryMethod = extractMethod;

  let fields = finalizeFields(partial, opts);
  let recoveredFromRawText = false;

  if (!fields.assistantReplyText && !fields.assistantEnglishText) {
    const plain = recoverPlainTextAnswer(raw);
    if (plain) {
      fields = finalizeFields(
        { ...partial, assistantReplyText: plain, assistantEnglishText: plain },
        opts,
      );
      recoveredFromRawText = true;
      recoveryMethod = 'plain_text';
    }
  }

  const parsedJsonOk = parsedAssistantFromObject;
  const hasAnswer = Boolean(fields.assistantReplyText || fields.assistantEnglishText);
  const parseStatus = deriveParseStatus({ hasAnswer, parsedJsonOk, recoveryMethod });
  const isRefusal = hasAnswer && isGenericRefusalText(fields.assistantReplyText || fields.assistantEnglishText, fallbackMessage);

  let fallbackReason: CompletionFallbackReason = null;
  let shouldRetryCompletion = false;

  if (!hasAnswer) {
    fallbackReason = effectiveParsed ? 'missing_assistant_reply_text' : 'json_parse_failed';
    shouldRetryCompletion = !opts.allowGenericFallback;
  } else if (isRefusal && !opts.allowGenericFallback) {
    fallbackReason = 'model_returned_fallback_despite_evidence';
    fields = finalizeFields({}, opts);
    recoveredFromRawText = false;
    shouldRetryCompletion = true;
  }

  return {
    fields,
    parsedJsonOk,
    parseStatus: isRefusal && !opts.allowGenericFallback ? 'failed' : parseStatus,
    recoveredFromRawText,
    recoveryMethod,
    fallbackReason,
    rawCompletionPreview,
    shouldRetryCompletion,
  };
}
