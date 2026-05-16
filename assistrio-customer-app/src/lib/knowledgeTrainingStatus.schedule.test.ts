import { describe, expect, it } from 'vitest';
import {
  inferKnowledgeTrainingStatusFromKbDisplayLabel,
  knowledgeTrainingListScheduleSubline,
  knowledgeTrainingRunAfterCountdown,
  knowledgeTrainingStatusLabel,
  mergeKbTrainingLifecycleForDisplay,
} from '@/lib/knowledgeTrainingStatus';

describe('knowledgeTrainingRunAfterCountdown', () => {
  it('returns Training soon when run time is in the past or due', () => {
    const past = '2020-01-01T00:00:00.000Z';
    expect(knowledgeTrainingRunAfterCountdown(past, Date.now())).toBe('Training soon');
  });

  it('returns a MM:SS countdown when run time is in the future within an hour', () => {
    const now = Date.parse('2026-05-09T12:00:00.000Z');
    const run = new Date(now + 90_000).toISOString();
    expect(knowledgeTrainingRunAfterCountdown(run, now)).toBe('01:30');
  });
});

describe('mergeKbTrainingLifecycleForDisplay', () => {
  it('does not let a stale poll ready hide bot pending', () => {
    expect(mergeKbTrainingLifecycleForDisplay('pending', 'ready')).toBe('pending');
  });

  it('does not let a stale bot ready hide poll queued', () => {
    expect(mergeKbTrainingLifecycleForDisplay('ready', 'queued')).toBe('queued');
  });

  it('prefers further non-ready pipeline stage when both differ', () => {
    expect(mergeKbTrainingLifecycleForDisplay('pending', 'queued')).toBe('queued');
    expect(mergeKbTrainingLifecycleForDisplay('queued', 'processing')).toBe('processing');
  });

  it('keeps ready when both agree', () => {
    expect(mergeKbTrainingLifecycleForDisplay('ready', 'ready')).toBe('ready');
  });
});

describe('knowledgeTrainingStatusLabel', () => {
  it('maps queued vs processing distinctly', () => {
    expect(knowledgeTrainingStatusLabel('queued')).toBe('Training Queued');
    expect(knowledgeTrainingStatusLabel('processing')).toBe('Training');
  });

  it('maps pending, ready, and failed', () => {
    expect(knowledgeTrainingStatusLabel('pending')).toBe('Training Required');
    expect(knowledgeTrainingStatusLabel('ready')).toBe('Trained');
    expect(knowledgeTrainingStatusLabel('failed')).toBe('Training Failed');
  });

  it('uses exact customer-facing capitalization for all lifecycle labels', () => {
    expect(knowledgeTrainingStatusLabel('ready')).toBe('Trained');
    expect(knowledgeTrainingStatusLabel('queued')).toBe('Training Queued');
    expect(knowledgeTrainingStatusLabel('pending')).toBe('Training Required');
    expect(knowledgeTrainingStatusLabel('processing')).toBe('Training');
    expect(knowledgeTrainingStatusLabel('failed')).toBe('Training Failed');
  });
});

describe('inferKnowledgeTrainingStatusFromKbDisplayLabel', () => {
  it('maps Training Failed chip text to failed', () => {
    expect(inferKnowledgeTrainingStatusFromKbDisplayLabel('Training Failed')).toBe('failed');
  });
});

describe('knowledgeTrainingListScheduleSubline', () => {
  it('shows nothing for pending even when runAfter is set', () => {
    expect(knowledgeTrainingListScheduleSubline('pending', null, Date.now())).toBeNull();
    const now = Date.parse('2026-05-09T12:00:00.000Z');
    const run = new Date(now + 125_000).toISOString();
    expect(knowledgeTrainingListScheduleSubline('pending', run, now)).toBeNull();
  });

  it('shows countdown for queued + future runAfter', () => {
    const now = Date.parse('2026-05-09T12:00:00.000Z');
    const run = new Date(now + 125_000).toISOString();
    expect(knowledgeTrainingListScheduleSubline('queued', run, now)).toBe('02:05');
  });

  it('shows Training soon for queued when runAfter is already due', () => {
    const now = Date.parse('2026-05-09T12:00:00.000Z');
    const run = new Date(now - 1_000).toISOString();
    expect(knowledgeTrainingListScheduleSubline('queued', run, now)).toBe('Training soon');
  });
});
