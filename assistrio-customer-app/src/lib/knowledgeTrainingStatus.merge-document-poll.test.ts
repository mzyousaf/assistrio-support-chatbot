import { describe, expect, it } from 'vitest';
import { mergeDocumentRowCanonicalTrainingStatus } from './knowledgeTrainingStatus';

describe('mergeDocumentRowCanonicalTrainingStatus (ingest job vs KB poll)', () => {
  it('does not force Training when ingest job is still processing but extract is done and poll is pending', () => {
    expect(
      mergeDocumentRowCanonicalTrainingStatus('pending', 'pending', {
        latestIngestJobStatus: 'processing',
        extractionStatus: 'done',
        displayStatus: 'training_required',
      }),
    ).toBe('pending');
  });

  it('does not force Training when ingest job is processing but poll is queued (auto train)', () => {
    expect(
      mergeDocumentRowCanonicalTrainingStatus('pending', 'queued', {
        latestIngestJobStatus: 'processing',
        extractionStatus: 'done',
        displayStatus: 'training_queued',
      }),
    ).toBe('queued');
  });

  it('still returns processing when poll lifecycle is processing (real training)', () => {
    expect(
      mergeDocumentRowCanonicalTrainingStatus('processing', 'processing', {
        latestIngestJobStatus: 'processing',
        extractionStatus: 'done',
        displayStatus: 'training',
      }),
    ).toBe('processing');
  });

  it('keeps ingest job processing while extract runs (poll pending)', () => {
    expect(
      mergeDocumentRowCanonicalTrainingStatus('pending', 'pending', {
        latestIngestJobStatus: 'processing',
        extractionStatus: 'processing',
        displayStatus: 'extracting_text',
      }),
    ).toBe('processing');
  });

  it('does not force Training Queued when ingest job queued but poll is pending (manual train)', () => {
    expect(
      mergeDocumentRowCanonicalTrainingStatus('pending', 'pending', {
        latestIngestJobStatus: 'queued',
        extractionStatus: 'done',
        displayStatus: 'training_required',
      }),
    ).toBe('pending');
  });

  it('keeps queued when poll and ingest job both queued after extract', () => {
    expect(
      mergeDocumentRowCanonicalTrainingStatus('pending', 'queued', {
        latestIngestJobStatus: 'queued',
        extractionStatus: 'done',
        displayStatus: 'training_queued',
      }),
    ).toBe('queued');
  });
});
