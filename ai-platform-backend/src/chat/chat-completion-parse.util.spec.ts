import {
  buildTranslationContractSystemSuffix,
  buildTranslationResponseFormat,
  createTranslationCompletionWithFormatFallback,
  DEFAULT_CHAT_FALLBACK_MESSAGE,
  isGenericRefusalText,
  isResponseFormatSchemaInvalidError,
  parseTranslationCompletion,
} from './chat-completion-parse.util';

const strongEvidenceOpts = { allowGenericFallback: false };
const weakEvidenceOpts = { allowGenericFallback: true };

const schemaInvalidError = Object.assign(new Error("400 Invalid schema for response_format 'chat_translation_completion'"), {
  status: 400,
});

describe('parseTranslationCompletion', () => {
  it('uses valid JSON with slim assistant-only schema', () => {
    const raw = JSON.stringify({
      assistantReplyText:
        'Assistrio is an AI support platform with chat widgets and knowledge bases.',
      assistantReplyLanguage: 'English',
      assistantEnglishText: null,
    });
    const result = parseTranslationCompletion(raw, strongEvidenceOpts);
    expect(result.parsedJsonOk).toBe(true);
    expect(result.parseStatus).toBe('valid_json');
    expect(result.fallbackReason).toBeNull();
    expect(result.fields.assistantReplyText.length).toBeGreaterThan(0);
    expect(result.fields.assistantEnglishText).toBe(result.fields.assistantReplyText);
    expect(result.shouldRetryCompletion).toBe(false);
  });

  it('recovers plain text answer when JSON parsing fails but prose is present', () => {
    const prose =
      'Assistrio helps businesses deploy AI support chatbots trained on their knowledge base, with widgets, analytics, and lead capture.';
    const result = parseTranslationCompletion(prose, strongEvidenceOpts);
    expect(result.parseStatus).toBe('recovered_plain_text');
    expect(result.recoveredFromRawText).toBe(true);
    expect(result.fields.assistantReplyText).toContain('Assistrio');
    expect(result.fallbackReason).toBeNull();
  });

  it('marks regex recovery as recovered_json_field without treating as hard failure', () => {
    const raw =
      '{ "assistantReplyText": "Assistrio offers AI chatbots and knowledge management.", "assistantReplyLanguage": "English", "assistantEnglishText": null, broken';
    const result = parseTranslationCompletion(raw, strongEvidenceOpts);
    expect(result.parsedJsonOk).toBe(false);
    expect(result.parseStatus).toBe('recovered_json_field');
    expect(result.fields.assistantReplyText).toContain('Assistrio');
    expect(result.fallbackReason).toBeNull();
  });

  it('uses generic fallback path when answerability requires fallback and completion is empty', () => {
    const result = parseTranslationCompletion('', weakEvidenceOpts);
    expect(result.parseStatus).toBe('failed');
    expect(result.fallbackReason).toBe('empty_completion');
    expect(result.fields.assistantReplyText).toBe('');
    expect(result.shouldRetryCompletion).toBe(false);
  });

  it('flags model refusal despite evidence and requests retry', () => {
    const raw = JSON.stringify({
      assistantReplyText: DEFAULT_CHAT_FALLBACK_MESSAGE,
      assistantReplyLanguage: 'English',
      assistantEnglishText: DEFAULT_CHAT_FALLBACK_MESSAGE,
    });
    const result = parseTranslationCompletion(raw, strongEvidenceOpts);
    expect(result.fallbackReason).toBe('model_returned_fallback_despite_evidence');
    expect(result.parseStatus).toBe('failed');
    expect(result.shouldRetryCompletion).toBe(true);
    expect(result.fields.assistantReplyText).toBe('');
  });

  it('reports json_parse_failed when malformed and no recoverable answer', () => {
    const result = parseTranslationCompletion('{not json at all', strongEvidenceOpts);
    expect(result.fallbackReason).toBe('json_parse_failed');
    expect(result.parseStatus).toBe('failed');
    expect(result.shouldRetryCompletion).toBe(true);
  });

  it('reports missing_assistant_reply_text when JSON parses but fields are empty', () => {
    const raw = JSON.stringify({
      assistantReplyText: '',
      assistantReplyLanguage: 'English',
      assistantEnglishText: null,
    });
    const result = parseTranslationCompletion(raw, strongEvidenceOpts);
    expect(result.fallbackReason).toBe('missing_assistant_reply_text');
    expect(result.parseStatus).toBe('failed');
    expect(result.shouldRetryCompletion).toBe(true);
  });
});

describe('buildTranslationContractSystemSuffix', () => {
  it('requires assistantReplyText to be Markdown inside JSON', () => {
    const suffix = buildTranslationContractSystemSuffix('english_only');
    expect(suffix).toContain('assistantReplyText');
    expect(suffix).toContain('valid Markdown');
    expect(suffix).toContain('Fast customer support');
    expect(suffix).toContain('Do not put inline citation markers');
    expect(suffix).toContain('Default to "- " bullet lists');
    expect(suffix).toContain('numbered lists ("1. ", "2. ", …) only for step-by-step');
    expect(suffix).toContain('tier-specific heading rules');
  });
});

describe('buildTranslationResponseFormat', () => {
  it('requires assistantReplyText, assistantReplyLanguage, and assistantEnglishText', () => {
    const fmt = buildTranslationResponseFormat();
    expect(fmt?.type).toBe('json_schema');
    if (fmt?.type !== 'json_schema') return;
    const schema = fmt.json_schema.schema as {
      required?: string[];
      additionalProperties?: boolean;
      properties?: Record<string, { type?: string | string[] }>;
    };
    expect(schema.required).toEqual([
      'assistantReplyText',
      'assistantReplyLanguage',
      'assistantEnglishText',
    ]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties?.assistantEnglishText?.type).toEqual(['string', 'null']);
  });
});

describe('isResponseFormatSchemaInvalidError', () => {
  it('detects OpenAI 400 invalid schema errors', () => {
    expect(isResponseFormatSchemaInvalidError(schemaInvalidError)).toBe(true);
    expect(isResponseFormatSchemaInvalidError(new Error('network'))).toBe(false);
  });
});

describe('createTranslationCompletionWithFormatFallback', () => {
  it('retries once with json_object when json_schema is rejected', async () => {
    const formats: string[] = [];
    const completion = {
      choices: [{ message: { content: '{"assistantReplyText":"Assistrio overview.","assistantReplyLanguage":"English","assistantEnglishText":null}' } }],
    };

    const result = await createTranslationCompletionWithFormatFallback(async (format) => {
      formats.push(format?.type ?? 'unknown');
      if (format?.type === 'json_schema') throw schemaInvalidError;
      return completion as never;
    });

    expect(formats).toEqual(['json_schema', 'json_object']);
    expect(result.usedJsonObjectFallback).toBe(true);
    expect(result.completion).toBe(completion);
  });

  it('with strong evidence, json_object fallback completion still parses to assistant text', async () => {
    const payload = JSON.stringify({
      assistantReplyText: 'Assistrio provides AI support chatbots with knowledge bases and analytics.',
      assistantReplyLanguage: 'English',
      assistantEnglishText: null,
    });
    const completion = { choices: [{ message: { content: payload } }] };

    const { completion: rawCompletion } = await createTranslationCompletionWithFormatFallback(
      async (format) => {
        if (format?.type === 'json_schema') throw schemaInvalidError;
        return completion as never;
      },
    );

    const raw = rawCompletion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = parseTranslationCompletion(raw, strongEvidenceOpts);
    expect(parsed.parseStatus).toBe('valid_json');
    expect(parsed.fallbackReason).toBeNull();
    expect(parsed.fields.assistantReplyText.length).toBeGreaterThan(0);
  });
});

describe('isGenericRefusalText', () => {
  it('detects canned insufficient-information replies', () => {
    expect(isGenericRefusalText(DEFAULT_CHAT_FALLBACK_MESSAGE)).toBe(true);
    expect(isGenericRefusalText("I don't have enough information to answer that.")).toBe(true);
    expect(isGenericRefusalText('Assistrio is a customer support AI platform.')).toBe(false);
  });
});
