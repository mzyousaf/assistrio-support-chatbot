import {
  narrowPrimarySubTopic,
  narrowSubTopicLabelArray,
  normalizeSubTopicToken,
} from './topic-sentiment-classification.subtopics';

describe('topic-sentiment-classification.subtopics', () => {
  it('normalizeSubTopicToken lowercases and underscores', () => {
    expect(normalizeSubTopicToken(' Failed Payment ')).toBe('failed_payment');
  });

  it('narrowPrimarySubTopic accepts valid sub for main', () => {
    expect(narrowPrimarySubTopic('failed_payment', 'billing')).toBe('failed_payment');
  });

  it('narrowPrimarySubTopic rejects sub not under main', () => {
    expect(narrowPrimarySubTopic('wordpress', 'billing')).toBeUndefined();
  });

  it('narrowSubTopicLabelArray keeps subs valid for any listed main and dedupes', () => {
    const out = narrowSubTopicLabelArray(
      ['refund_request', 'refund_request', 'failed_payment', 'not_a_sub'],
      ['billing', 'refund'],
      5,
    );
    expect(out).toEqual(['refund_request', 'failed_payment']);
  });
});
