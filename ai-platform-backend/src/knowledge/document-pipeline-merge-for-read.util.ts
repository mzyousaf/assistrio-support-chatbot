import type { IngestJobStatus } from '../models';
import { overlayStaleLivePipelineJobForRead } from './pipeline-job-stale-at-read.util';

/** Extract/Train job fields used for merge + stale-at-read overlay (documents list + KB status polling). */
export type DocumentPipelineJobMergeInput = {
  status: IngestJobStatus;
  queuedAt?: Date;
  runAfter?: Date;
  finishedAt?: Date;
  startedAt?: Date | null;
  processingStartedAt?: Date | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
};

export type MergedDocumentPipelineJobRow = {
  status: IngestJobStatus;
  queuedAt?: Date;
  runAfter?: Date;
  finishedAt?: Date;
};

/** Prefer train-job activity while embedding; otherwise extract (file → text). */
export function mergeExtractTrainJobRow(
  ex?: Pick<DocumentPipelineJobMergeInput, 'status' | 'queuedAt' | 'runAfter' | 'finishedAt'>,
  tr?: Pick<DocumentPipelineJobMergeInput, 'status' | 'queuedAt' | 'runAfter' | 'finishedAt'>,
): MergedDocumentPipelineJobRow | undefined {
  const trainActive = tr && (tr.status === 'queued' || tr.status === 'processing');
  const extractActive = ex && (ex.status === 'queued' || ex.status === 'processing');
  if (trainActive) {
    return {
      status: tr!.status,
      queuedAt: tr!.queuedAt,
      runAfter: tr!.runAfter,
      finishedAt: tr!.finishedAt,
    };
  }
  if (extractActive) {
    return {
      status: ex!.status,
      queuedAt: ex!.queuedAt,
      runAfter: ex!.runAfter,
      finishedAt: ex!.finishedAt,
    };
  }
  if (tr) {
    const fin =
      tr.status === 'done'
        ? tr.finishedAt
        : ex?.status === 'done'
          ? ex.finishedAt
          : tr.finishedAt ?? ex?.finishedAt;
    return {
      status: tr.status,
      queuedAt: tr.queuedAt,
      runAfter: tr.runAfter,
      finishedAt: fin,
    };
  }
  if (ex) {
    return {
      status: ex.status,
      queuedAt: ex.queuedAt,
      runAfter: ex.runAfter,
      finishedAt: ex.finishedAt,
    };
  }
  return undefined;
}

/** Overlay zombie queued/processing jobs, then merge extract + train into one ingest signal for API reads. */
export function mergeDocumentPipelineJobsForCustomerRead(
  ex: DocumentPipelineJobMergeInput | undefined,
  tr: DocumentPipelineJobMergeInput | undefined,
  extractStaleMs: number,
  trainStaleMs: number,
): MergedDocumentPipelineJobRow | undefined {
  const exAdj = overlayStaleLivePipelineJobForRead(ex, extractStaleMs);
  const trAdj = overlayStaleLivePipelineJobForRead(tr, trainStaleMs);
  return mergeExtractTrainJobRow(exAdj, trAdj);
}
