import { canFinalizeKnowledgeItemTraining } from './knowledge-training-finalize.helper';

describe('canFinalizeKnowledgeItemTraining', () => {
  const snap = { contentHash: 'deadbeef', lastContentUpdatedAt: new Date('2024-01-01T00:00:00.000Z') };

  it('returns false when item missing', () => {
    expect(canFinalizeKnowledgeItemTraining(null, snap)).toBe(false);
  });

  it('returns true when use-in-replies is off (`active:false`) but snapshot matches processing row', () => {
    expect(
      canFinalizeKnowledgeItemTraining(
        {
          active: false,
          status: 'processing',
          contentHash: snap.contentHash,
          lastContentUpdatedAt: snap.lastContentUpdatedAt,
        },
        snap,
      ),
    ).toBe(true);
  });

  it('returns false when status is not processing', () => {
    expect(
      canFinalizeKnowledgeItemTraining(
        { active: true, status: 'queued', contentHash: snap.contentHash, lastContentUpdatedAt: snap.lastContentUpdatedAt },
        snap,
      ),
    ).toBe(false);
  });

  it('returns false when contentHash changed after snapshot', () => {
    expect(
      canFinalizeKnowledgeItemTraining(
        { active: true, status: 'processing', contentHash: 'newhash000000000000000000000000', lastContentUpdatedAt: snap.lastContentUpdatedAt },
        snap,
      ),
    ).toBe(false);
  });

  it('returns false when lastContentUpdatedAt changed', () => {
    expect(
      canFinalizeKnowledgeItemTraining(
        {
          active: true,
          status: 'processing',
          contentHash: snap.contentHash,
          lastContentUpdatedAt: new Date('2025-06-06T00:00:00.000Z'),
        },
        snap,
      ),
    ).toBe(false);
  });

  it('returns true for matching processing item and snapshot', () => {
    expect(
      canFinalizeKnowledgeItemTraining(
        {
          active: true,
          status: 'processing',
          contentHash: snap.contentHash,
          lastContentUpdatedAt: snap.lastContentUpdatedAt,
        },
        snap,
      ),
    ).toBe(true);
  });
});
