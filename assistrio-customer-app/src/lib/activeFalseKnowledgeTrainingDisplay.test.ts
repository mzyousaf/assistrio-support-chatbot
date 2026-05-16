import { describe, expect, it } from 'vitest';
import {
  getKnowledgeItemDisplayStatus,
  getKnowledgeItemReplyUsageLabel,
} from '@/lib/knowledgeItemDisplayStatus';
import { knowledgeTrainingListScheduleSubline } from '@/lib/knowledgeTrainingStatus';

describe('active:false trainable items — reply usage vs training vs timer', () => {
  const now = Date.parse('2026-05-09T12:00:00.000Z');
  const runAfterSoon = new Date(now + 125_000).toISOString();

  it('queued + runAfter: Not used in replies, Training Queued, schedule subline when canonical is queued', () => {
    expect(getKnowledgeItemReplyUsageLabel(false)).toBe('Not used in replies');
    const d = getKnowledgeItemDisplayStatus({
      sourceType: 'faq',
      active: false,
      status: 'queued',
      isTraining: true,
    });
    expect(d.label).toBe('Training Queued');
    expect(d.dotCanon).toBe('queued');
    expect(knowledgeTrainingListScheduleSubline('queued', runAfterSoon, now)).toBe('02:05');
  });

  it('processing: Not used in replies, Training, no queued countdown', () => {
    expect(getKnowledgeItemReplyUsageLabel(false)).toBe('Not used in replies');
    const d = getKnowledgeItemDisplayStatus({ sourceType: 'faq', active: false, status: 'processing' });
    expect(d.label).toBe('Training');
    expect(knowledgeTrainingListScheduleSubline('processing', runAfterSoon, now)).toBeNull();
  });

  it('ready: Not used in replies, Trained', () => {
    expect(getKnowledgeItemReplyUsageLabel(false)).toBe('Not used in replies');
    const d = getKnowledgeItemDisplayStatus({ sourceType: 'faq', active: false, status: 'ready' });
    expect(d.label).toBe('Trained');
    expect(d.dotCanon).toBe('ready');
  });

  it('queued never shows the processing label (only processing does)', () => {
    const q = getKnowledgeItemDisplayStatus({
      sourceType: 'note',
      active: false,
      status: 'queued',
      isTraining: true,
    });
    expect(q.label).not.toBe('Training');
    expect(q.label).toBe('Training Queued');
    const p = getKnowledgeItemDisplayStatus({ sourceType: 'note', status: 'processing' });
    expect(p.label).toBe('Training');
  });

  it('pending + runAfter still has no schedule subline (only queued shows timer)', () => {
    expect(knowledgeTrainingListScheduleSubline('pending', runAfterSoon, now)).toBeNull();
  });
});
