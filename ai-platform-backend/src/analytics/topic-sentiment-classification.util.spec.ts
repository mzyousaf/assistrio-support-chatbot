import {
  fallbackClassificationForShortOrEmptyInput,
  narrowSentimentLabel,
  narrowTopicId,
  parseTopicSentimentJsonFromModelText,
  rollupConversationTopicSentimentFromUserMessages,
  sanitizeLlmClassificationPayload,
  sanitizeSentimentReason,
} from './topic-sentiment-classification.util';

describe('topic-sentiment-classification.util', () => {
  it('narrowTopicId maps invalid to other', () => {
    expect(narrowTopicId('not_a_topic')).toBe('other');
    expect(narrowTopicId('pricing')).toBe('pricing');
  });

  it('dedupes topic labels and caps at 3', () => {
    const s = sanitizeLlmClassificationPayload({
      primaryTopic: 'pricing',
      topicLabels: ['pricing', 'pricing', 'billing', 'sales', 'refund'],
      topicConfidence: 0.9,
      sentiment: { label: 'neutral', score: 0 },
    });
    expect(s.topics.topicLabels.length).toBeLessThanOrEqual(3);
    expect(new Set(s.topics.topicLabels).size).toBe(s.topics.topicLabels.length);
  });

  it('accepts mixed sentiment label', () => {
    const s = sanitizeLlmClassificationPayload({
      primaryTopic: 'complaint',
      topicLabels: ['complaint'],
      topicConfidence: 0.7,
      sentiment: { label: 'mixed', score: 0.1 },
    });
    expect(s.sentiment.label).toBe('mixed');
  });

  it('invalid sentiment label becomes unknown', () => {
    expect(narrowSentimentLabel('elated')).toBe('unknown');
    const s = sanitizeLlmClassificationPayload({
      primaryTopic: 'other',
      topicLabels: ['other'],
      topicConfidence: 0.5,
      sentiment: { label: 'elated', score: 0 },
    });
    expect(s.sentiment.label).toBe('unknown');
  });

  it('clamps sentiment score', () => {
    const s = sanitizeLlmClassificationPayload({
      primaryTopic: 'other',
      topicLabels: ['other'],
      topicConfidence: 1,
      sentiment: { label: 'negative', score: -9 },
    });
    expect(s.sentiment.score).toBe(-1);
  });

  it('caps reason to 80 chars', () => {
    const long = 'x'.repeat(120);
    expect(sanitizeSentimentReason(long)!.length).toBe(80);
  });

  it('raw medical hints in model output map to general_question', () => {
    const s = sanitizeLlmClassificationPayload({
      primaryTopic: 'pricing',
      topicLabels: ['medical billing question'],
      topicConfidence: 0.9,
      sentiment: { label: 'neutral', score: 0 },
    });
    expect(s.topics.primaryTopic).toBe('general_question');
  });

  it('rollup primaryTopic by frequency with latest tie-break', () => {
    const t0 = new Date('2024-01-01T12:00:00Z');
    const t1 = new Date('2024-01-01T12:01:00Z');
    const t2 = new Date('2024-01-01T12:02:00Z');
    const r = rollupConversationTopicSentimentFromUserMessages([
      { createdAt: t0, primaryTopic: 'pricing', sentimentLabel: 'neutral', sentimentScore: 0 },
      { createdAt: t1, primaryTopic: 'billing', sentimentLabel: 'neutral', sentimentScore: 0 },
      { createdAt: t2, primaryTopic: 'billing', sentimentLabel: 'neutral', sentimentScore: 0 },
    ]);
    expect(r?.conversationTopics.primaryTopic).toBe('billing');
  });

  it('rollup sentiment mixed when positive and negative appear', () => {
    const base = new Date();
    const r = rollupConversationTopicSentimentFromUserMessages([
      { createdAt: base, primaryTopic: 'other', sentimentLabel: 'positive', sentimentScore: 0.8 },
      { createdAt: base, primaryTopic: 'other', sentimentLabel: 'negative', sentimentScore: -0.8 },
    ]);
    expect(r?.conversationSentiment.label).toBe('mixed');
  });

  it('rollup sentiment from average score thresholds', () => {
    const base = new Date();
    const r = rollupConversationTopicSentimentFromUserMessages([
      { createdAt: base, primaryTopic: 'other', sentimentLabel: 'unknown', sentimentScore: -0.5 },
      { createdAt: base, primaryTopic: 'other', sentimentLabel: 'unknown', sentimentScore: -0.4 },
    ]);
    expect(r?.conversationSentiment.label).toBe('negative');
  });

  it('rollup returns null when no classified signals', () => {
    expect(rollupConversationTopicSentimentFromUserMessages([])).toBeNull();
    expect(
      rollupConversationTopicSentimentFromUserMessages([
        { createdAt: new Date(), primaryTopic: '', sentimentLabel: undefined, sentimentScore: undefined },
      ]),
    ).toBeNull();
  });

  it('rollup sentiment unknown when only topics present', () => {
    const r = rollupConversationTopicSentimentFromUserMessages([
      { createdAt: new Date(), primaryTopic: 'pricing', sentimentLabel: undefined, sentimentScore: undefined },
    ]);
    expect(r?.conversationSentiment.label).toBe('unknown');
    expect(r?.conversationTopics.primaryTopic).toBe('pricing');
  });

  it('parseTopicSentimentJsonFromModelText handles wrapped JSON', () => {
    const p = parseTopicSentimentJsonFromModelText('here is json {"primaryTopic":"sales","topicConfidence":0.5}');
    expect(p?.primaryTopic).toBe('sales');
  });

  it('fallback for empty input', () => {
    const f = fallbackClassificationForShortOrEmptyInput();
    expect(f.topics.primaryTopic).toBe('other');
    expect(f.sentiment.label).toBe('unknown');
  });

  it('invalid main topic becomes other', () => {
    const s = sanitizeLlmClassificationPayload({
      primaryTopic: 'not_in_taxonomy',
      topicLabels: ['not_in_taxonomy'],
      topicConfidence: 0.5,
      sentiment: { label: 'neutral', score: 0 },
    });
    expect(s.topics.primaryTopic).toBe('other');
  });

  it('accepts valid sub-topic for primary and caps subTopicLabels', () => {
    const s = sanitizeLlmClassificationPayload({
      primaryTopic: 'billing',
      topicLabels: ['billing', 'refund'],
      primarySubTopic: 'failed_payment',
      subTopicLabels: [
        'failed_payment',
        'refund_request',
        'invoice',
        'payment_method',
        'tax',
        'overcharge',
        'refund_status',
      ],
      topicConfidence: 0.82,
      sentiment: { label: 'negative', score: -0.6, reason: 'Frustrated about payment issue' },
    });
    expect(s.topics.primaryTopic).toBe('billing');
    expect(s.topics.primarySubTopic).toBe('failed_payment');
    expect(s.topics.subTopicLabels?.length).toBeLessThanOrEqual(5);
    expect(new Set(s.topics.subTopicLabels).size).toBe(s.topics.subTopicLabels?.length);
    expect(s.topics.subTopicLabels).toContain('failed_payment');
  });

  it('omits primarySubTopic when invalid for primary', () => {
    const s = sanitizeLlmClassificationPayload({
      primaryTopic: 'billing',
      topicLabels: ['billing'],
      primarySubTopic: 'wordpress',
      subTopicLabels: ['wordpress'],
      topicConfidence: 0.7,
      sentiment: { label: 'neutral', score: 0 },
    });
    expect(s.topics.primarySubTopic).toBeUndefined();
    expect(s.topics.subTopicLabels ?? []).toEqual([]);
  });

  it('rollup includes main and sub-topic fields', () => {
    const b = new Date('2024-01-01T12:00:00Z');
    const r = rollupConversationTopicSentimentFromUserMessages([
      {
        createdAt: b,
        primaryTopic: 'billing',
        topicLabels: ['billing'],
        primarySubTopic: 'failed_payment',
        subTopicLabels: ['failed_payment'],
        sentimentLabel: 'negative',
        sentimentScore: -0.5,
      },
      {
        createdAt: b,
        primaryTopic: 'billing',
        topicLabels: ['billing'],
        primarySubTopic: 'invoice',
        subTopicLabels: ['invoice'],
        sentimentLabel: 'negative',
        sentimentScore: -0.4,
      },
    ]);
    expect(r?.conversationTopics.primaryTopic).toBe('billing');
    expect(r?.conversationTopics.primarySubTopic).toBe('invoice');
    expect(r?.conversationTopics.subTopicLabels?.length).toBeGreaterThan(0);
  });
});
