import {
  PIPELINE_JOB_STALE_AT_READ_ERROR,
  overlayStaleLivePipelineJobForRead,
} from './pipeline-job-stale-at-read.util';

describe('pipeline-job-stale-at-read.util', () => {
  it('leaves fresh processing jobs unchanged', () => {
    const now = Date.now();
    const job = {
      status: 'processing',
      startedAt: new Date(now - 60_000),
      updatedAt: new Date(now - 60_000),
    };
    expect(overlayStaleLivePipelineJobForRead(job, 20 * 60_000)).toBe(job);
  });

  it('synthesizes failed when processing past stale window', () => {
    const old = new Date(Date.now() - 25 * 60_000);
    const job = { status: 'processing', startedAt: old, updatedAt: old };
    const out = overlayStaleLivePipelineJobForRead(job, 20 * 60_000) as {
      status?: string;
      error?: string;
    };
    expect(out.status).toBe('failed');
    expect(out.error).toBe(PIPELINE_JOB_STALE_AT_READ_ERROR);
  });

  it('does not synthesize when timestamps missing', () => {
    const job = { status: 'processing' };
    expect(overlayStaleLivePipelineJobForRead(job as never, 20 * 60_000)).toBe(job);
  });
});
