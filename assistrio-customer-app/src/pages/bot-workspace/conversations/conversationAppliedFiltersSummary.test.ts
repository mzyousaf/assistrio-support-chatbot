import { describe, expect, it } from 'vitest';
import {
  conversationAppliedFiltersSummary,
  removeAppliedConversationFilterByChipId,
} from './conversationFiltersModel';

describe('conversationAppliedFiltersSummary', () => {
  it('returns empty when no filters', () => {
    expect(conversationAppliedFiltersSummary({})).toEqual([]);
  });

  it('includes date label when range is set', () => {
    const chips = conversationAppliedFiltersSummary({
      dateFrom: '2026-05-01T00:00:00.000Z',
      dateTo: '2026-05-07T00:00:00.000Z',
    });
    const d = chips.find((c) => c.id === 'date');
    expect(d).toBeDefined();
    expect(d!.label).toMatch(/–| - /);
  });

  it('lists widget channels', () => {
    const chips = conversationAppliedFiltersSummary({
      startedFrom: 'runtime_widget,runtime_iframe',
    });
    const ch = chips.find((c) => c.id === 'channels');
    expect(ch).toBeDefined();
    expect(ch!.label).toContain(', ');
  });

  it('reflects tri-state traits', () => {
    const chips = conversationAppliedFiltersSummary({
      hasLead: true,
      hasVoice: false,
    });
    expect(chips.some((c) => c.label.startsWith('Lead captured'))).toBe(true);
    expect(chips.some((c) => c.label.startsWith('Voice messages'))).toBe(true);
  });

  it('includes primary topics, other topics, and sentiments (sorted labels)', () => {
    const chips = conversationAppliedFiltersSummary({
      primaryTopics: 'billing,pricing',
      secondaryTopics: 'refund',
      sentiments: 'neutral,positive',
    });
    expect(chips.find((c) => c.id === 'topic-primary')).toEqual({
      id: 'topic-primary',
      label: 'Primary topics: Pricing, Billing',
    });
    expect(chips.find((c) => c.id === 'topic-secondary')).toEqual({
      id: 'topic-secondary',
      label: 'Other topics: Refund',
    });
    expect(chips.find((c) => c.id === 'sentiments')).toEqual({
      id: 'sentiments',
      label: 'Sentiments: Positive, Neutral',
    });
  });
});

describe('removeAppliedConversationFilterByChipId', () => {
  it('removes date range', () => {
    const out = removeAppliedConversationFilterByChipId(
      { dateFrom: 'a', dateTo: 'b', startedFrom: 'runtime_widget' },
      'date',
    );
    expect(out.dateFrom).toBeUndefined();
    expect(out.dateTo).toBeUndefined();
    expect(out.startedFrom).toBe('runtime_widget');
  });

  it('clears credits bundle', () => {
    const out = removeAppliedConversationFilterByChipId(
      { creditsGtZero: true, minMessages: 5 },
      'credits',
    );
    expect(out.creditsGtZero).toBeUndefined();
    expect(out.minMessages).toBe(5);
  });

  it('returns same reference for unknown chip id', () => {
    const p = { hasLead: true };
    expect(removeAppliedConversationFilterByChipId(p, 'nope')).toBe(p);
  });

  it('clears topic & sentiment dimensions', () => {
    const base = {
      primaryTopics: 'pricing',
      secondaryTopics: 'billing',
      sentiments: 'positive',
      hasLead: true,
    };
    expect(removeAppliedConversationFilterByChipId(base, 'topic-primary')).toEqual({
      secondaryTopics: 'billing',
      sentiments: 'positive',
      hasLead: true,
    });
    expect(removeAppliedConversationFilterByChipId(base, 'topic-secondary')).toEqual({
      primaryTopics: 'pricing',
      sentiments: 'positive',
      hasLead: true,
    });
    expect(removeAppliedConversationFilterByChipId(base, 'sentiments')).toEqual({
      primaryTopics: 'pricing',
      secondaryTopics: 'billing',
      hasLead: true,
    });
  });
});
