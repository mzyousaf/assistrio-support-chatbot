/**
 * Documents list merges latest ExtractJob + TrainJob into one “ingest” signal. When worker cron has not
 * yet advanced stuck rows, hide infinite Training by treating zombie queued/processing jobs as failed
 * for display only (Mongo unchanged until cron/manual retry runs).
 */

/** Matches stable codes consumers may branch on; DB rows stay untouched by read overlay. */
export const PIPELINE_JOB_STALE_AT_READ_ERROR = 'pipeline_job_stale_at_read';

export type PipelineJobLeanTouchFields = {
  status?: string;
  startedAt?: Date | null;
  processingStartedAt?: Date | null;
  queuedAt?: Date | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
};

function touchMs(job: PipelineJobLeanTouchFields): number | undefined {
  const ds = [
    job.startedAt,
    job.processingStartedAt,
    job.queuedAt,
    job.updatedAt,
    job.createdAt,
  ].filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
  if (ds.length === 0) return undefined;
  return Math.max(...ds.map((d) => d.getTime()));
}

/**
 * When job looks live (`queued`/`processing`) but nothing advanced for staleAfterMs, synthesize `failed`
 * so merge/display matches worker SLA expectations between cron ticks.
 */
export function overlayStaleLivePipelineJobForRead<T extends PipelineJobLeanTouchFields>(
  job: T | undefined,
  staleAfterMs: number,
): T | undefined {
  if (!job) return undefined;
  const st = String(job.status ?? '');
  if (st !== 'queued' && st !== 'processing') return job;
  const t = touchMs(job);
  if (t == null) return job;
  if (Date.now() - t <= staleAfterMs) return job;
  const finishedAt =
    job.updatedAt instanceof Date && !isNaN(job.updatedAt.getTime()) ? job.updatedAt : new Date(t);
  return {
    ...job,
    status: 'failed',
    finishedAt,
    error: PIPELINE_JOB_STALE_AT_READ_ERROR,
  } as T;
}
