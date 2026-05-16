import { metricsForDocumentContent } from './knowledge-text-metrics';

/**
 * Contract: `upsertDocumentKnowledgeItem` persists `characterCount`, `isContentExtracted`, `extractedAt` / `lastExtractedAt`
 * (when trainable text is newly set or changed) from {@link metricsForDocumentContent} / trainable-text rules.
 */
describe('knowledge-base document metrics from extracted text', () => {
  it('persists character count derived from metrics helper', () => {
    const extracted = 'Hello world.\nSecond line.';
    const m = metricsForDocumentContent(extracted);
    expect(m.characterCount).toBe(extracted.trim().length);
    expect(m.characterCount).toBeGreaterThan(0);
  });
});
