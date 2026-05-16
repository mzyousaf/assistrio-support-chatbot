import { Types } from 'mongoose';
import {
  ASSISTANT_MESSAGE_SOURCES_MAX,
  extractRetrievalScoreForMessageSource,
  inferSourceTypeFromHints,
  mapRagSourceTypeToMessageSourceType,
  normalizeAssistantMessageSourcesForPersistence,
} from './assistant-message-sources.normalize';

const KB_ID = '507f1f77bcf86cd799439011';

describe('mapRagSourceTypeToMessageSourceType', () => {
  it('maps table to datasheet', () => {
    expect(mapRagSourceTypeToMessageSourceType('table')).toBe('datasheet');
  });
  it('maps url and html to website', () => {
    expect(mapRagSourceTypeToMessageSourceType('url')).toBe('website');
    expect(mapRagSourceTypeToMessageSourceType('html')).toBe('website');
  });
  it('preserves document', () => {
    expect(mapRagSourceTypeToMessageSourceType('document')).toBe('document');
  });
});

describe('inferSourceTypeFromHints', () => {
  it('infers faq', () => {
    expect(inferSourceTypeFromHints('Company FAQ')).toBe('faq');
  });
  it('infers note', () => {
    expect(inferSourceTypeFromHints('Internal note')).toBe('note');
  });
  it('infers datasheet from table hint', () => {
    expect(inferSourceTypeFromHints('pricing.csv')).toBe('datasheet');
  });
  it('infers suggestion', () => {
    expect(inferSourceTypeFromHints('trainable suggestion chip')).toBe('suggestion');
  });
  it('infers website from url', () => {
    expect(inferSourceTypeFromHints('https://example.com/page')).toBe('website');
  });
  it('infers manual_text', () => {
    expect(inferSourceTypeFromHints('manual_text block')).toBe('manual_text');
  });
  it('infers document from pdf', () => {
    expect(inferSourceTypeFromHints('report.pdf')).toBe('document');
  });
  it('unknown fallback', () => {
    expect(inferSourceTypeFromHints('')).toBe('unknown');
  });
});

describe('extractRetrievalScoreForMessageSource', () => {
  it('reads combinedScore from EnrichedChunk-shaped rows', () => {
    expect(
      extractRetrievalScoreForMessageSource({
        combinedScore: 0.82,
      } as Record<string, unknown>),
    ).toBe(0.82);
  });

  it('preserves score 0', () => {
    expect(extractRetrievalScoreForMessageSource({ score: 0 })).toBe(0);
    expect(extractRetrievalScoreForMessageSource({ combinedScore: 0 })).toBe(0);
  });

  it('parses safe numeric score strings', () => {
    expect(extractRetrievalScoreForMessageSource({ score: '0.75' })).toBe(0.75);
  });

  it('prefers explicit score over combinedScore', () => {
    expect(
      extractRetrievalScoreForMessageSource({
        score: 0.1,
        combinedScore: 0.9,
      }),
    ).toBe(0.1);
  });

  it('returns undefined when no usable score', () => {
    expect(extractRetrievalScoreForMessageSource({ score: 'nope' })).toBeUndefined();
  });
});

describe('normalizeAssistantMessageSourcesForPersistence', () => {
  const used = new Date('2026-05-01T12:00:00.000Z');

  it('maps combinedScore from unified retrieval to persisted score', () => {
    const [row] = normalizeAssistantMessageSourcesForPersistence({
      sources: [
        {
          chunkId: 'ch1',
          documentId: KB_ID,
          title: 'Doc',
          text: 'body',
          semanticScore: 0.2,
          lexicalScore: 0.3,
          combinedScore: 0.82,
          sourceType: 'document',
        },
      ],
      assistantMessageCreatedAt: used,
    });
    expect(row.score).toBe(0.82);
  });

  it('keeps legacy docId, docTitle, preview, score', () => {
    const [row] = normalizeAssistantMessageSourcesForPersistence({
      sources: [
        {
          chunkId: 'ch1',
          docId: KB_ID,
          docTitle: 'Legacy title',
          preview: 'Hello world',
          score: 0.42,
        },
      ],
      assistantMessageCreatedAt: used,
    });
    expect(row.chunkId).toBe('ch1');
    expect(row.docId).toBe(KB_ID);
    expect(row.docTitle).toBe('Legacy title');
    expect(row.preview).toBe('Hello world');
    expect(row.score).toBe(0.42);
    expect(row.knowledgeBaseItemId?.toString()).toBe(KB_ID);
    expect(row.usedAt?.getTime()).toBe(used.getTime());
  });

  it('preserves explicit sourceType when provided', () => {
    const [row] = normalizeAssistantMessageSourcesForPersistence({
      sources: [{ chunkId: 'c', docId: KB_ID, sourceType: 'faq', title: 'Q?' }],
      assistantMessageCreatedAt: used,
    });
    expect(row.sourceType).toBe('faq');
  });

  it('adds sourceTitle from title and sourceUrl from url', () => {
    const [row] = normalizeAssistantMessageSourcesForPersistence({
      sources: [
        {
          chunkId: 'c1',
          documentId: KB_ID,
          title: 'My doc',
          text: 'excerpt text',
          score: 0.5,
          sourceType: 'document',
          url: 'https://cdn.example/f.pdf',
        },
      ],
      assistantMessageCreatedAt: used,
    });
    expect(row.sourceTitle).toBe('My doc');
    expect(row.docTitle).toBe('My doc');
    expect(row.sourceUrl).toBe('https://cdn.example/f.pdf');
  });

  it('drops non-numeric score', () => {
    const [row] = normalizeAssistantMessageSourcesForPersistence({
      sources: [{ chunkId: 'c', docId: KB_ID, score: 'bad' as unknown as number }],
      assistantMessageCreatedAt: used,
    });
    expect(row.score).toBeUndefined();
  });

  it('limits max source count', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      chunkId: `c${i}`,
      docId: KB_ID,
      preview: `p${i}`,
    }));
    const out = normalizeAssistantMessageSourcesForPersistence({
      sources: many,
      assistantMessageCreatedAt: used,
    });
    expect(out.length).toBe(ASSISTANT_MESSAGE_SOURCES_MAX);
  });

  it('drops rows with no useful data', () => {
    expect(
      normalizeAssistantMessageSourcesForPersistence({
        sources: [{ sourceType: 'document' }],
        assistantMessageCreatedAt: used,
      }).length,
    ).toBe(0);
  });

  it('skips invalid knowledgeBaseItemId on docId', () => {
    const [row] = normalizeAssistantMessageSourcesForPersistence({
      sources: [{ chunkId: 'x', docId: 'not-an-objectid', preview: 'hi' }],
      assistantMessageCreatedAt: used,
    });
    expect(row.knowledgeBaseItemId).toBeUndefined();
  });

  it('uses explicit knowledgeBaseItemId when valid', () => {
    const [row] = normalizeAssistantMessageSourcesForPersistence({
      sources: [{ chunkId: 'x', preview: 'hi', knowledgeBaseItemId: KB_ID }],
      assistantMessageCreatedAt: used,
    });
    expect(row.knowledgeBaseItemId).toBeInstanceOf(Types.ObjectId);
    expect(row.knowledgeBaseItemId?.toString()).toBe(KB_ID);
  });
});
