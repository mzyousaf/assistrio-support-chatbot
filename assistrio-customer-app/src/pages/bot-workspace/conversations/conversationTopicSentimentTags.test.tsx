import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerConversationDetail, CustomerConversationMessage } from '@/api/types';
import {
  formatSentimentScoreForDisplay,
  messageShouldShowTopicSentimentTags,
  sentimentTaxonomyCustomerLabel,
  topicTaxonomyCustomerLabel,
} from './conversationTopicSentimentDisplay';
import { MessageTopicSentimentTags, SentimentTag, TopicTag } from './MessageTopicSentimentTags';

function baseUser(partial: Partial<CustomerConversationMessage>): CustomerConversationMessage {
  return {
    id: 'm1',
    messageId: 'm1',
    role: 'user',
    content: 'hi',
    text: 'hi',
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('conversationTopicSentimentDisplay', () => {
  it('maps billing topic id to Billing', () => {
    expect(topicTaxonomyCustomerLabel('billing')).toBe('Billing');
  });

  it('maps negative sentiment key to Negative', () => {
    expect(sentimentTaxonomyCustomerLabel('negative')).toBe('Negative');
  });

  it('formats sentiment score as numeric string', () => {
    expect(formatSentimentScoreForDisplay(-0.61999)).toBe('-0.62');
    expect(formatSentimentScoreForDisplay(0)).toBe('0');
  });

  it('messageShouldShowTopicSentimentTags is false for assistant', () => {
    const m = baseUser({ role: 'assistant', topics: { primaryTopic: 'billing' } });
    expect(messageShouldShowTopicSentimentTags(m)).toBe(false);
  });

  it('messageShouldShowTopicSentimentTags is false when only unknown sentiment', () => {
    const m = baseUser({ sentiment: { label: 'unknown' } });
    expect(messageShouldShowTopicSentimentTags(m)).toBe(false);
  });

  it('messageShouldShowTopicSentimentTags is true for user with topic or classified sentiment', () => {
    expect(messageShouldShowTopicSentimentTags(baseUser({ topics: { primaryTopic: 'pricing' } }))).toBe(true);
    expect(messageShouldShowTopicSentimentTags(baseUser({ sentiment: { label: 'negative', score: -0.5 } }))).toBe(
      true,
    );
  });
});

describe('MessageTopicSentimentTags', () => {
  it('TopicTag renders product label for taxonomy id', () => {
    const html = renderToStaticMarkup(<TopicTag topicId="technical_support" />);
    expect(html).toContain('Technical support');
  });

  it('SentimentTag renders label only', () => {
    const html = renderToStaticMarkup(<SentimentTag labelKey="negative" />);
    expect(html).toContain('Negative');
    expect(html).not.toContain('-0.62');
  });

  it('renders nothing for user message without topics/sentiment data', () => {
    const html = renderToStaticMarkup(<MessageTopicSentimentTags message={baseUser({})} />);
    expect(html).toBe('');
  });

  it('renders primary + sentiment tags for user message with topics (sub topics in modal)', () => {
    const html = renderToStaticMarkup(
      <MessageTopicSentimentTags
        message={baseUser({
          topics: { primaryTopic: 'billing', topicLabels: ['technical_support'] },
          sentiment: { label: 'negative', score: -0.5 },
        })}
      />,
    );
    expect(html).toContain('Billing');
    expect(html).toContain('Negative');
    expect(html).toContain('type="button"');
    expect(html).not.toContain('Technical support');
  });
});

describe('Conversation General Details topic/sentiment copy', () => {
  it('derives same primary and topics labels as detail payload', () => {
    const detail = {
      conversationTopics: { primaryTopic: 'billing', topicLabels: ['technical_support'] },
      conversationSentiment: { label: 'negative' as const, score: -0.62 },
    } as CustomerConversationDetail;
    const primary = detail.conversationTopics?.primaryTopic?.trim()
      ? topicTaxonomyCustomerLabel(detail.conversationTopics.primaryTopic)
      : 'Not analyzed';
    const topicsLine = (detail.conversationTopics?.topicLabels ?? []).length
      ? [...new Set((detail.conversationTopics!.topicLabels ?? []).map((id) => topicTaxonomyCustomerLabel(id)))].join(
          ', ',
        )
      : 'Not analyzed';
    expect(primary).toBe('Billing');
    expect(topicsLine).toBe('Technical support');
  });
});
