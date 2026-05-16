import { describe, expect, it } from '@jest/globals';
import { actionableRetrainOrBranches } from './immediate-retrain-queue.util';

describe('actionableRetrainOrBranches', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('includes pending + future scheduled queued (+ failed when includeFailed)', () => {
    const b = actionableRetrainOrBranches(true, false, now);
    expect(b).toEqual([
      { status: 'pending' },
      { status: 'failed' },
      { status: 'queued', runAfter: { $gt: now } },
    ]);
  });

  it('extends with ready when force-retrain-all is enabled', () => {
    const b = actionableRetrainOrBranches(true, true, now);
    expect(b).toContainEqual({ status: 'ready' });
  });

  it('omits failed when includeFailed is false', () => {
    const b = actionableRetrainOrBranches(false, false, now);
    expect(b.find((x) => (x as { status?: string }).status === 'failed')).toBeUndefined();
  });
});
