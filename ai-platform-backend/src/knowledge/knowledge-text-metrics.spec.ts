import {
  estimateTextMetricsFromKnowledgeItemLean,
  isTrainableExtractedDocumentText,
  metricsForDocumentContent,
  metricsForSuggestionRow,
} from './knowledge-text-metrics';

describe('knowledge-text-metrics (document ingestion gate)', () => {
  describe('metricsForDocumentContent', () => {
    it('returns zero metrics for whitespace-only strings', () => {
      expect(metricsForDocumentContent('   \n')).toEqual({
        characterCount: 0,
      });
    });
  });

  describe('isTrainableExtractedDocumentText', () => {
    it('is true only when trimmed text has positive character count', () => {
      expect(isTrainableExtractedDocumentText('hello')).toBe(true);
      expect(isTrainableExtractedDocumentText('a b')).toBe(true);
    });

    it('is false for empty / whitespace-only', () => {
      expect(isTrainableExtractedDocumentText('')).toBe(false);
      expect(isTrainableExtractedDocumentText(' \t')).toBe(false);
    });
  });
});

describe('metricsForSuggestionRow', () => {
  it('counts scoped text only, not chip label', () => {
    expect(
      metricsForSuggestionRow({
        chipText: 'x'.repeat(500),
        scopedInformation: 'hello',
      }),
    ).toEqual({ characterCount: 5 });
  });

  it('is zero for label-only inputs', () => {
    expect(metricsForSuggestionRow({ chipText: 'chip', scopedInformation: '' })).toEqual({
      characterCount: 0,
    });
    expect(metricsForSuggestionRow({ chipText: 'chip' })).toEqual({ characterCount: 0 });
  });
});

describe('estimateTextMetricsFromKnowledgeItemLean (suggestion)', () => {
  it('uses suggestionMeta.scopedInformation when characterCount is absent', () => {
    expect(
      estimateTextMetricsFromKnowledgeItemLean({
        sourceType: 'suggestion',
        content: 'chip: long embedding line',
        suggestionMeta: { scopedInformation: 'scope' },
      }),
    ).toEqual({ characterCount: 5 });
  });

  it('falls back to rawContent context and ignores chip-only content', () => {
    expect(
      estimateTextMetricsFromKnowledgeItemLean({
        sourceType: 'suggestion',
        content: 'full embed',
        rawContent: JSON.stringify({ label: 'L', context: 'ctx' }),
      }),
    ).toEqual({ characterCount: 3 });
  });
});
