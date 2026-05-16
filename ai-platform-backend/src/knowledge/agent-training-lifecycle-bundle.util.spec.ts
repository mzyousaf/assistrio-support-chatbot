import { describe, expect, it } from '@jest/globals';
import { rollupAgentTrainingLifecycleBundle } from './agent-training-lifecycle-bundle.util';
import type { MergedDocumentPipelineJobRow } from './document-pipeline-merge-for-read.util';

describe('rollupAgentTrainingLifecycleBundle', () => {
  const now = new Date('2026-01-15T12:00:00.000Z');
  const rowBase = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    sourceType: 'document',
    status: 'processing',
    extractionStatus: 'done' as const,
    isContentExtracted: true,
    characterCount: 100,
    updatedAt: now,
  };

  it('counts processing from merged job when KB row is still queued', () => {
    const row = { ...rowBase, status: 'queued' as const };
    const merged = new Map<string, MergedDocumentPipelineJobRow>([
      ['507f1f77bcf86cd799439011', { status: 'processing' as const }],
    ]);
    const b = rollupAgentTrainingLifecycleBundle({
      rows: [rowBase],
      now,
      mergedIngestByKbId: merged,
      embedByKbId: new Map([['507f1f77bcf86cd799439011', 3]]),
    });
    expect(b.lm.processingItems).toBe(1);
    expect(b.lm.dueQueuedItems).toBe(0);
    expect(b.lifecycleCounts.trainingProcessingCount).toBe(1);
    expect(b.lifecycleCounts.trainingQueuedCount).toBe(0);
  });

  it('counts queued when KB says processing but job is queued and chunks absent', () => {
    const merged = new Map<string, MergedDocumentPipelineJobRow>([
      ['507f1f77bcf86cd799439011', { status: 'queued' as const }],
    ]);
    const b = rollupAgentTrainingLifecycleBundle({
      rows: [rowBase],
      now,
      mergedIngestByKbId: merged,
      embedByKbId: new Map([['507f1f77bcf86cd799439011', 0]]),
    });
    expect(b.lm.dueQueuedItems).toBe(1);
    expect(b.lm.processingItems).toBe(0);
  });
});
