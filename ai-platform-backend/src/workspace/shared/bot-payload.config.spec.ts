import {
  collectResponseStyleConfigUnsetKeys,
  normalizeAnswerMode,
  normalizeConfigInput,
  shouldUnsetResponseStyleDescription,
  shouldUnsetResponseStyleInstructions,
  shouldUnsetResponseStyleMode,
} from './bot-payload';
import { BOT_FIELD_MAX } from './bot-field-limits';

describe('normalizeConfigInput', () => {
  it('snaps maxTokens to nearest preset and derives responseLength', () => {
    const cfg = normalizeConfigInput({ maxTokens: 288, responseLength: 'medium' });
    expect(cfg.maxTokens).toBe(256);
    expect(cfg.responseLength).toBe('long');
  });

  it('snaps plus presets and maps enums', () => {
    expect(normalizeConfigInput({ maxTokens: 80 }).maxTokens).toBe(80);
    expect(normalizeConfigInput({ maxTokens: 80 }).responseLength).toBe('short');
    expect(normalizeConfigInput({ maxTokens: 128 }).responseLength).toBe('medium');
    expect(normalizeConfigInput({ maxTokens: 208 }).responseLength).toBe('long');
    expect(normalizeConfigInput({ maxTokens: 384 }).responseLength).toBe('long');
  });

  it('maps Standard preset 160 to medium', () => {
    const cfg = normalizeConfigInput({ maxTokens: 160 });
    expect(cfg.maxTokens).toBe(160);
    expect(cfg.responseLength).toBe('medium');
  });

  it('maps Complete preset 512 to long', () => {
    const cfg = normalizeConfigInput({ maxTokens: 512 });
    expect(cfg.maxTokens).toBe(512);
    expect(cfg.responseLength).toBe('long');
  });

  it('trims and stores responseStyleInstructions', () => {
    const cfg = normalizeConfigInput({
      temperature: 0.3,
      maxTokens: 160,
      responseLength: 'medium',
      responseStyleInstructions: '  Use short bullet points.  ',
    });
    expect(cfg.responseStyleInstructions).toBe('Use short bullet points.');
  });

  it('omits empty responseStyleInstructions', () => {
    const cfg = normalizeConfigInput({
      responseStyleInstructions: '   ',
    });
    expect(cfg.responseStyleInstructions).toBeUndefined();
  });

  it('caps over-limit responseStyleInstructions', () => {
    const long = 'x'.repeat(BOT_FIELD_MAX.responseStyleInstructions + 50);
    const cfg = normalizeConfigInput({ responseStyleInstructions: long });
    expect(cfg.responseStyleInstructions?.length).toBe(BOT_FIELD_MAX.responseStyleInstructions);
  });

  it('preserves temperature 0 and 1', () => {
    expect(normalizeConfigInput({ temperature: 0 }).temperature).toBe(0);
    expect(normalizeConfigInput({ temperature: 1 }).temperature).toBe(1);
  });
});

describe('shouldUnsetResponseStyleInstructions', () => {
  it('returns true for null or blank explicit clears', () => {
    expect(shouldUnsetResponseStyleInstructions({ responseStyleInstructions: null })).toBe(true);
    expect(shouldUnsetResponseStyleInstructions({ responseStyleInstructions: '  ' })).toBe(true);
    expect(shouldUnsetResponseStyleInstructions({})).toBe(false);
  });
});

describe('answerMode config', () => {
  it('normalizes answerMode knowledge_first and knowledge_only', () => {
    expect(normalizeConfigInput({ answerMode: 'knowledge_only' }).answerMode).toBe('knowledge_only');
    expect(normalizeConfigInput({ answerMode: 'knowledge_first' }).answerMode).toBe('knowledge_first');
    expect(normalizeAnswerMode(undefined)).toBe('knowledge_first');
    expect(normalizeAnswerMode('knowledge_only')).toBe('knowledge_only');
  });
});

describe('structured response style config', () => {
  it('accepts responseStyleMode free and structured', () => {
    expect(normalizeConfigInput({ responseStyleMode: 'free' }).responseStyleMode).toBe('free');
    expect(normalizeConfigInput({ responseStyleMode: 'structured' }).responseStyleMode).toBe('structured');
  });

  it('trims and caps responseStyleDescription', () => {
    const long = 'd'.repeat(BOT_FIELD_MAX.responseStyleDescription + 10);
    const cfg = normalizeConfigInput({
      responseStyleDescription: `  ${long}  `,
    });
    expect(cfg.responseStyleDescription?.length).toBe(BOT_FIELD_MAX.responseStyleDescription);
  });

  it('collects unset keys when clearing structured style', () => {
    const keys = collectResponseStyleConfigUnsetKeys({
      responseStyleInstructions: null,
      responseStyleDescription: null,
      responseStyleMode: null,
      responseStyleRefinedAt: null,
    });
    expect(keys).toEqual(
      expect.arrayContaining([
        'responseStyleInstructions',
        'responseStyleDescription',
        'responseStyleMode',
        'responseStyleRefinedAt',
      ]),
    );
    expect(shouldUnsetResponseStyleDescription({ responseStyleDescription: '  ' })).toBe(true);
    expect(shouldUnsetResponseStyleMode({ responseStyleMode: null })).toBe(true);
  });
});
