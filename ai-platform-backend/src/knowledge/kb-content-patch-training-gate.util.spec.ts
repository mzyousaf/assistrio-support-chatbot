import {
  KB_CONTENT_PATCH_TRAIN_GATE_IMMINENT_MS,
  kbContentPatchBlockedByTrainingGate,
} from './kb-content-patch-training-gate.util';

describe('kbContentPatchBlockedByTrainingGate', () => {
  const t0 = new Date('2026-06-01T12:00:00.000Z').getTime();

  it('blocks when processing', () => {
    expect(kbContentPatchBlockedByTrainingGate('processing', undefined, t0, 10_000)).toBe(true);
  });

  it('allows pending / ready / failed', () => {
    expect(kbContentPatchBlockedByTrainingGate('pending', undefined, t0, 10_000)).toBe(false);
    expect(kbContentPatchBlockedByTrainingGate('ready', undefined, t0, 10_000)).toBe(false);
    expect(kbContentPatchBlockedByTrainingGate('failed', undefined, t0, 10_000)).toBe(false);
  });

  it('queues: blocks when overdue or missing runAfter', () => {
    expect(kbContentPatchBlockedByTrainingGate('queued', new Date(t0 - 60_000), t0, 10_000)).toBe(true);
    expect(kbContentPatchBlockedByTrainingGate('queued', undefined, t0, 10_000)).toBe(true);
  });

  it('queues: blocks within imminent window ahead of runAfter', () => {
    expect(
      kbContentPatchBlockedByTrainingGate(
        'queued',
        new Date(t0 + 5_000),
        t0,
        KB_CONTENT_PATCH_TRAIN_GATE_IMMINENT_MS,
      ),
    ).toBe(true);
  });

  it('queues: allows when runAfter is beyond imminent window', () => {
    expect(
      kbContentPatchBlockedByTrainingGate(
        'queued',
        new Date(t0 + 120_000),
        t0,
        KB_CONTENT_PATCH_TRAIN_GATE_IMMINENT_MS,
      ),
    ).toBe(false);
  });
});
