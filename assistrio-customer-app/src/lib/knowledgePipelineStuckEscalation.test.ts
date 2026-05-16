import { describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_PIPELINE_STUCK_ESCALATION_AFTER_MS,
  knowledgePipelineAllowStuckItemDelete,
  knowledgePipelineStuckEligible,
  knowledgePipelineStuckReferenceMs,
} from './knowledgePipelineStuckEscalation';

describe('knowledgePipelineStuckEscalation', () => {
  it('treats extracting_text as stuck when lastQueuedAt is older than threshold', () => {
    const old = new Date(Date.now() - KNOWLEDGE_PIPELINE_STUCK_ESCALATION_AFTER_MS - 60_000).toISOString();
    const ts = {
      displayStatus: 'extracting_text',
      lastQueuedAt: old,
      updatedAt: old,
      createdAt: null,
      lastTrainingStartedAt: null,
    };
    expect(knowledgePipelineStuckReferenceMs(ts)).not.toBeNull();
    expect(knowledgePipelineStuckEligible(ts)).toBe(true);
    expect(knowledgePipelineAllowStuckItemDelete(ts)).toBe(true);
  });

  it('does not escalate recent extracting_text', () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    const ts = {
      displayStatus: 'extracting_text',
      lastQueuedAt: recent,
      updatedAt: recent,
      createdAt: null,
      lastTrainingStartedAt: null,
    };
    expect(knowledgePipelineStuckEligible(ts)).toBe(false);
    expect(knowledgePipelineAllowStuckItemDelete(ts)).toBe(false);
  });

  it('uses updatedAt for failed after threshold', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
    const old = new Date('2026-05-10T11:00:00.000Z').toISOString();
    const ts = {
      displayStatus: 'failed',
      updatedAt: old,
      lastQueuedAt: null,
      lastTrainingStartedAt: null,
      createdAt: null,
    };
    expect(knowledgePipelineStuckEligible(ts)).toBe(true);
    expect(knowledgePipelineAllowStuckItemDelete(ts)).toBe(true);
    vi.useRealTimers();
  });
});
