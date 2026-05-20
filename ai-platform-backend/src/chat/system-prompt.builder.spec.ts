import {
  buildSystemPrompt,
  COMPLETE_RESPONSE_LENGTH_MARKER,
  DETAILED_RESPONSE_LENGTH_MARKER,
  FORMATTING_RULES_MARKER,
  MARKDOWN_BULLET_DEFAULT_RULE,
  MARKDOWN_BULLET_LIST_REQUEST_RULE,
  MARKDOWN_COMPLETE_HEADINGS_RULE,
  MARKDOWN_CREATIVE_WAYS_EXAMPLE,
  MARKDOWN_DETAILED_BULLETS_RULE,
  MARKDOWN_NO_HEADINGS_STANDARD_TIERS,
  MARKDOWN_NUMBERED_LIST_RULE,
  MARKDOWN_STEP_BY_STEP_EXAMPLE,
  resolveResponseLengthTier,
  RESPONSE_STYLE_SUBORDINATE_RULE,
  SHORT_RESPONSE_LENGTH_MARKER,
  STANDARD_RESPONSE_LENGTH_MARKER,
  TINY_RESPONSE_LENGTH_MARKER,
} from './system-prompt.builder';

const baseInput = {
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

describe('resolveResponseLengthTier', () => {
  it('maps token caps to prompt tiers from maxTokens', () => {
    expect(resolveResponseLengthTier(64, 'short')).toBe('tiny');
    expect(resolveResponseLengthTier(80, 'short')).toBe('short');
    expect(resolveResponseLengthTier(96, 'short')).toBe('short');
    expect(resolveResponseLengthTier(128, 'medium')).toBe('standard');
    expect(resolveResponseLengthTier(160, 'medium')).toBe('standard');
    expect(resolveResponseLengthTier(208, 'long')).toBe('detailed');
    expect(resolveResponseLengthTier(256, 'long')).toBe('detailed');
    expect(resolveResponseLengthTier(384, 'long')).toBe('complete');
    expect(resolveResponseLengthTier(512, 'long')).toBe('complete');
  });
});

describe('buildSystemPrompt response length tiers', () => {
  it('Tiny uses one short line instruction', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, responseLength: 'short', maxTokens: 64 },
    });
    expect(prompt).toContain(TINY_RESPONSE_LENGTH_MARKER);
    expect(prompt).not.toContain(STANDARD_RESPONSE_LENGTH_MARKER);
  });

  it('Short uses concise-sentence instruction', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, responseLength: 'short', maxTokens: 96 },
    });
    expect(prompt).toContain(SHORT_RESPONSE_LENGTH_MARKER);
    expect(prompt).not.toContain(TINY_RESPONSE_LENGTH_MARKER);
  });

  it('Tiny+ (80) uses short-tier sentences', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, maxTokens: 80 },
    });
    expect(prompt).toContain(SHORT_RESPONSE_LENGTH_MARKER);
  });

  it('Standard+ (208) uses detailed-tier bullets guidance', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, maxTokens: 208 },
    });
    expect(prompt).toContain(DETAILED_RESPONSE_LENGTH_MARKER);
  });

  it('Detailed+ (384) uses complete-tier sections guidance', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, maxTokens: 384 },
    });
    expect(prompt).toContain(COMPLETE_RESPONSE_LENGTH_MARKER);
  });

  it('Standard uses one concise paragraph and bullets only for list requests', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, responseLength: 'medium', maxTokens: 160 },
    });
    expect(prompt).toContain(STANDARD_RESPONSE_LENGTH_MARKER);
    expect(prompt).toContain('one concise paragraph');
    expect(prompt).toMatch(/Use "- " bullets only when the user asks for a list/i);
  });

  it('Detailed uses 3–4 short bullets when useful for explanatory questions', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, responseLength: 'long', maxTokens: 256 },
    });
    expect(prompt).toContain(DETAILED_RESPONSE_LENGTH_MARKER);
    expect(prompt).toContain('3–4 short bullets');
    expect(prompt).not.toContain(COMPLETE_RESPONSE_LENGTH_MARKER);
  });

  it('Complete uses mini-sections and avoids padding while keeping greetings brief', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, responseLength: 'long', maxTokens: 512 },
    });
    expect(prompt).toContain(COMPLETE_RESPONSE_LENGTH_MARKER);
    expect(prompt).toContain('mini-sections');
    expect(prompt).toContain('Overview');
    expect(prompt).toContain('Main features');
    expect(prompt).toContain('Benefits');
    expect(prompt).toMatch(/Avoid padding/i);
    expect(prompt).toMatch(/greetings.*stay brief/i);
    expect(prompt).not.toContain(DETAILED_RESPONSE_LENGTH_MARKER);
  });
});

describe('buildSystemPrompt creativity', () => {
  it('includes creativity section when temperature is set', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, temperature: 1 },
    });
    expect(prompt).toContain('--- Creativity / variation ---');
  });

  it('uses maximum-focus guidance at temperature 0', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, temperature: 0 },
    });
    expect(prompt).toContain('most stable, direct wording');
  });

  it('uses maximum variety guidance at temperature 1', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, temperature: 1 },
    });
    expect(prompt).toContain('maximum variety');
  });
});

describe('buildSystemPrompt response style preferences', () => {
  it('includes customer style section when instructions are set', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: {
        ...baseInput.behavior,
        responseStyleInstructions: 'Use 3 bullet points and keep the answer friendly.',
      },
    });
    expect(prompt).toContain('--- Response style preferences ---');
    expect(prompt).toContain('Use 3 bullet points');
    expect(prompt).toContain(RESPONSE_STYLE_SUBORDINATE_RULE);
  });

  it('omits response style section when instructions are empty', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, responseStyleInstructions: '   ' },
    });
    expect(prompt).not.toContain('--- Response style preferences ---');
  });
});

describe('buildSystemPrompt formatting', () => {
  it('requires Markdown replies without HTML or inline citations', () => {
    const prompt = buildSystemPrompt(baseInput);
    expect(prompt).toContain(FORMATTING_RULES_MARKER);
    expect(prompt).toContain('valid Markdown');
    expect(prompt).not.toMatch(/Use HTML/i);
    expect(prompt).toContain('Do not output HTML');
    expect(prompt).toContain('[source:1]');
    expect(prompt).toContain('Sources used');
    expect(prompt).toContain('- Benefit one');
    expect(prompt).toContain(MARKDOWN_BULLET_DEFAULT_RULE);
    expect(prompt).toContain(MARKDOWN_BULLET_LIST_REQUEST_RULE);
    expect(prompt).toContain(MARKDOWN_NUMBERED_LIST_RULE);
    expect(prompt).toContain(MARKDOWN_CREATIVE_WAYS_EXAMPLE);
    expect(prompt).toContain(MARKDOWN_STEP_BY_STEP_EXAMPLE);
    expect(prompt).toContain(MARKDOWN_NO_HEADINGS_STANDARD_TIERS);
    expect(prompt).toContain(MARKDOWN_DETAILED_BULLETS_RULE);
    expect(prompt).toContain(MARKDOWN_COMPLETE_HEADINGS_RULE);
    expect(prompt).toContain('do not use plain newline-separated lines');
  });

  it('Standard tier forbids headings and limits bullets to list requests', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, maxTokens: 160 },
    });
    expect(prompt).toContain(STANDARD_RESPONSE_LENGTH_MARKER);
    expect(prompt).toContain('no ## headings');
    expect(prompt).toContain('one concise paragraph by default');
    expect(prompt).toContain('Markdown structure: one concise paragraph by default—no ## headings');
  });

  it('Detailed tier allows bullets and optional single heading', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, maxTokens: 256 },
    });
    expect(prompt).toContain(DETAILED_RESPONSE_LENGTH_MARKER);
    expect(prompt).toContain('3–4 short "- " bullets');
    expect(prompt).toContain('At most one short ## heading');
    expect(prompt).toContain(MARKDOWN_DETAILED_BULLETS_RULE);
  });

  it('Complete tier allows headings and mini-sections for broad questions', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      behavior: { ...baseInput.behavior, maxTokens: 512 },
    });
    expect(prompt).toContain(COMPLETE_RESPONSE_LENGTH_MARKER);
    expect(prompt).toContain('## headings or mini-sections');
    expect(prompt).toContain('Overview');
    expect(prompt).toContain('Main features');
    expect(prompt).toContain('Benefits');
  });
});

describe('buildSystemPrompt answerMode', () => {
  it('includes knowledge-only instructions when answerMode is knowledge_only', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      answerMode: 'knowledge_only',
    });
    expect(prompt).toContain('--- Answer behavior (Knowledge-only) ---');
    expect(prompt).toContain('Do not create new examples');
    expect(prompt).toContain('do not have enough information in the available knowledge sources');
  });

  it('omits knowledge-only section for knowledge_first', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      answerMode: 'knowledge_first',
    });
    expect(prompt).not.toContain('--- Answer behavior (Knowledge-only) ---');
  });

  it('uses strict fallback grounding for knowledge_only when shouldUseFallback', () => {
    const prompt = buildSystemPrompt({
      ...baseInput,
      answerMode: 'knowledge_only',
      hasDocumentSnippets: true,
      answerability: {
        evidenceStrongEnough: true,
        directAnswerLikely: false,
        shouldUseFallback: true,
        shouldAnswerGenerally: false,
      },
    });
    expect(prompt).toContain('Do NOT invent facts, examples, templates');
    expect(prompt).not.toContain('only that this specific detail was not found');
  });
});
