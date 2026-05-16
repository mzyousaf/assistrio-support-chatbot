import { describe, expect, it } from '@jest/globals';
import { computeKbDocumentTrainingDisplay } from './document-effective-training-status.util';

describe('computeKbDocumentTrainingDisplay', () => {
  it('returns ready when job done, stale KB processing, embeddings exist', () => {
    expect(
      computeKbDocumentTrainingDisplay({
        knowledgeItemStatus: 'processing',
        latestIngestJobStatus: 'done',
        embeddedChunkCount: 3,
      }),
    ).toBe('ready');
  });

  it('returns processing while job is processing', () => {
    expect(
      computeKbDocumentTrainingDisplay({
        knowledgeItemStatus: 'ready',
        latestIngestJobStatus: 'processing',
        embeddedChunkCount: 8,
      }),
    ).toBe('processing');
  });

  it('returns queued when KB item is queued', () => {
    expect(
      computeKbDocumentTrainingDisplay({
        knowledgeItemStatus: 'queued',
        latestIngestJobStatus: 'done',
        embeddedChunkCount: 4,
      }),
    ).toBe('queued');
  });

  it('returns failed when KB says ready but embeddings are missing', () => {
    expect(
      computeKbDocumentTrainingDisplay({
        knowledgeItemStatus: 'ready',
        latestIngestJobStatus: 'done',
        embeddedChunkCount: 0,
      }),
    ).toBe('failed');
  });

  it('returns failed when latest ingest job failed', () => {
    expect(
      computeKbDocumentTrainingDisplay({
        knowledgeItemStatus: 'processing',
        latestIngestJobStatus: 'failed',
        embeddedChunkCount: 0,
      }),
    ).toBe('failed');
  });

  it('returns pending from KB', () => {
    expect(
      computeKbDocumentTrainingDisplay({
        knowledgeItemStatus: 'pending',
        latestIngestJobStatus: undefined,
        embeddedChunkCount: 0,
      }),
    ).toBe('pending');
  });
});
