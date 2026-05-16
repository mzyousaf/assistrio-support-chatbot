import {
  actionNeededItemDisplayStatus,
  isKnowledgeItemActionNeeded,
  isKnowledgeItemInTrainingPipeline,
} from './customer-training-lifecycle.util';

describe('customer-training-lifecycle.util', () => {
  const t0 = new Date('2026-03-01T12:00:00.000Z');
  const future = new Date('2026-03-02T12:00:00.000Z');
  const past = new Date('2026-02-01T12:00:00.000Z');

  describe('isKnowledgeItemActionNeeded', () => {
    it('counts pending and failed', () => {
      expect(isKnowledgeItemActionNeeded('pending', undefined, t0)).toBe(true);
      expect(isKnowledgeItemActionNeeded('failed', undefined, t0)).toBe(true);
    });

    it('counts queued with future runAfter only', () => {
      expect(isKnowledgeItemActionNeeded('queued', future, t0)).toBe(true);
      expect(isKnowledgeItemActionNeeded('queued', past, t0)).toBe(false);
      expect(isKnowledgeItemActionNeeded('queued', null, t0)).toBe(false);
    });

    it('excludes ready and processing', () => {
      expect(isKnowledgeItemActionNeeded('ready', undefined, t0)).toBe(false);
      expect(isKnowledgeItemActionNeeded('processing', undefined, t0)).toBe(false);
    });
  });

  describe('isKnowledgeItemInTrainingPipeline', () => {
    it('includes processing', () => {
      expect(isKnowledgeItemInTrainingPipeline('processing', undefined, t0)).toBe(true);
    });

    it('includes queued when due or missing runAfter', () => {
      expect(isKnowledgeItemInTrainingPipeline('queued', null, t0)).toBe(true);
      expect(isKnowledgeItemInTrainingPipeline('queued', past, t0)).toBe(true);
      expect(isKnowledgeItemInTrainingPipeline('queued', t0, t0)).toBe(true);
    });

    it('excludes future queued', () => {
      expect(isKnowledgeItemInTrainingPipeline('queued', future, t0)).toBe(false);
    });
  });

  describe('actionNeededItemDisplayStatus', () => {
    it('maps rows to badges', () => {
      expect(actionNeededItemDisplayStatus('pending', undefined, t0)).toBe('needs_training');
      expect(actionNeededItemDisplayStatus('failed', undefined, t0)).toBe('failed');
      expect(actionNeededItemDisplayStatus('queued', future, t0)).toBe('scheduled');
      expect(actionNeededItemDisplayStatus('queued', past, t0)).toBe(null);
      expect(actionNeededItemDisplayStatus('queued', null, t0)).toBe(null);
    });
  });
});
