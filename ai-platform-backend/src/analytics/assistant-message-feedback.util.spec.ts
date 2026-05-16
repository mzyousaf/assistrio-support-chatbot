import {
  extractAssistantFeedbackMessageId,
  inferAssistantFeedbackSource,
  normalizeAssistantFeedbackRating,
  parseOptionalObjectIdLike,
} from './assistant-message-feedback.util';

describe('normalizeAssistantFeedbackRating', () => {
  it('maps common positive and negative strings', () => {
    expect(normalizeAssistantFeedbackRating('up')).toBe('up');
    expect(normalizeAssistantFeedbackRating('LIKE')).toBe('up');
    expect(normalizeAssistantFeedbackRating('thumbs_up')).toBe('up');
    expect(normalizeAssistantFeedbackRating('down')).toBe('down');
    expect(normalizeAssistantFeedbackRating('Dislike')).toBe('down');
    expect(normalizeAssistantFeedbackRating('-1')).toBe('down');
  });

  it('maps numeric 1 / -1', () => {
    expect(normalizeAssistantFeedbackRating(1)).toBe('up');
    expect(normalizeAssistantFeedbackRating(-1)).toBe('down');
  });

  it('returns null for unknown values', () => {
    expect(normalizeAssistantFeedbackRating('maybe')).toBeNull();
    expect(normalizeAssistantFeedbackRating(2)).toBeNull();
    expect(normalizeAssistantFeedbackRating(null)).toBeNull();
  });
});

describe('extractAssistantFeedbackMessageId', () => {
  it('prefers messageId over assistantMessageId', () => {
    expect(
      extractAssistantFeedbackMessageId({
        messageId: '507f1f77bcf86cd799439011',
        assistantMessageId: '507f1f77bcf86cd799439012',
      }),
    ).toBe('507f1f77bcf86cd799439011');
  });

  it('falls back to assistantMessageId', () => {
    expect(extractAssistantFeedbackMessageId({ assistantMessageId: '507f1f77bcf86cd799439011' })).toBe(
      '507f1f77bcf86cd799439011',
    );
  });
});

describe('parseOptionalObjectIdLike', () => {
  it('accepts 24-hex strings', () => {
    const id = parseOptionalObjectIdLike('507f1f77bcf86cd799439011');
    expect(id?.toString()).toBe('507f1f77bcf86cd799439011');
  });

  it('rejects invalid strings', () => {
    expect(parseOptionalObjectIdLike('not-an-id')).toBeNull();
    expect(parseOptionalObjectIdLike('')).toBeNull();
  });
});

describe('inferAssistantFeedbackSource', () => {
  it('detects preview-ish sources', () => {
    expect(inferAssistantFeedbackSource({ source: 'widget_preview' })).toBe('preview');
    expect(inferAssistantFeedbackSource({ source: 'playground_preview' })).toBe('preview');
  });

  it('detects widget-ish sources', () => {
    expect(inferAssistantFeedbackSource({ source: 'runtime_widget' })).toBe('widget');
    expect(inferAssistantFeedbackSource({ source: 'iframe' })).toBe('widget');
  });

  it('defaults to unknown', () => {
    expect(inferAssistantFeedbackSource({})).toBe('unknown');
  });
});
