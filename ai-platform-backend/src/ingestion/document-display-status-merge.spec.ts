import { describe, expect, it } from '@jest/globals';

/**
 * Mirrors customer `mergeDocumentRowCanonicalTrainingStatus`.
 */
function mergeDocumentLikeUi(
  docRaw: string,
  pollRaw: string,
  meta?: { latestIngestJobStatus?: string | null },
): string {
  const norm = (s: string): string =>
    String(s ?? '')
      .trim()
      .toLowerCase() || 'pending';
  const d = norm(docRaw);
  const p = norm(pollRaw);
  const jl = normalizeJobLiteral(meta?.latestIngestJobStatus);

  if (d === 'failed' || p === 'failed') return 'failed';

  if (jl === 'processing') return 'processing';
  if (jl === 'queued') return 'queued';

  if (jl === 'failed') return 'failed';

  if (d === 'ready' && p === 'processing') {
    if (!jl || jl === 'done') return 'ready';
  }

  if (d === 'processing' || p === 'processing') {
    if (d === 'ready' && p === 'ready') return 'ready';
    return 'processing';
  }

  const pipeline = ['pending', 'queued', 'processing', 'ready'] as const;
  const ix = (x: string) => pipeline.indexOf(x as (typeof pipeline)[number]);
  const di = ix(d);
  const pi = ix(p);
  if (di >= 0 && pi >= 0) return pipeline[Math.max(di, pi)];
  return d;
}

function normalizeJobLiteral(raw: string | number | boolean | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'queued' || s === 'processing' || s === 'done' || s === 'failed') return s;
  return null;
}
describe('document list vs KB poll merge (parity with customer UI)', () => {
  it('does not oscillate queued vs processing — picks processing when job processing', () => {
    expect(mergeDocumentLikeUi('queued', 'processing', { latestIngestJobStatus: 'processing' })).toBe('processing');
    expect(
      mergeDocumentLikeUi('processing', 'queued', { latestIngestJobStatus: 'processing' }),
    ).toBe('processing');
  });

  it('shows failed if either feed reports failed', () => {
    expect(mergeDocumentLikeUi('ready', 'failed')).toBe('failed');
  });

  it('shows ready only when neither side is actively training', () => {
    expect(mergeDocumentLikeUi('ready', 'ready')).toBe('ready');
    expect(mergeDocumentLikeUi('ready', 'queued')).toBe('ready');
  });

  it('does not downgrade ready→processing when KB poll is stale but job is done', () => {
    expect(mergeDocumentLikeUi('ready', 'processing', { latestIngestJobStatus: 'done' })).toBe('ready');
  });

  it('without meta, trusts document ready over stale KB processing poll (server-first)', () => {
    expect(mergeDocumentLikeUi('ready', 'processing')).toBe('ready');
  });
});