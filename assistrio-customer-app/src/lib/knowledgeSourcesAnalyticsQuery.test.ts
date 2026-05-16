import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_SOURCES_ANALYTICS_DEFAULTS,
  buildKnowledgeSourcesAnalyticsApiParams,
  knowledgeSourcesAnalyticsQueryIncludesPreviewFlag,
} from './knowledgeSourcesAnalyticsQuery';

describe('buildKnowledgeSourcesAnalyticsApiParams', () => {
  it('maps sourceType when set', () => {
    const p = buildKnowledgeSourcesAnalyticsApiParams({
      ...KNOWLEDGE_SOURCES_ANALYTICS_DEFAULTS,
      sourceType: 'document',
    });
    expect(p.sourceType).toBe('document');
  });

  it('omits sourceType when empty', () => {
    const p = buildKnowledgeSourcesAnalyticsApiParams({
      ...KNOWLEDGE_SOURCES_ANALYTICS_DEFAULTS,
      sourceType: '',
    });
    expect(p.sourceType).toBeUndefined();
  });

  it('tracks includePreview false for query helper', () => {
    const p = buildKnowledgeSourcesAnalyticsApiParams({
      ...KNOWLEDGE_SOURCES_ANALYTICS_DEFAULTS,
      includePreview: false,
    });
    expect(knowledgeSourcesAnalyticsQueryIncludesPreviewFlag(p)).toBe(true);
  });
});
