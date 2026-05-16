import { BadRequestException } from '@nestjs/common';
import {
  TOPIC_TAXONOMY_ID_SET,
  TOPIC_TAXONOMY_IDS,
  type TopicTaxonomyId,
} from './topic-sentiment-classification.constants';
import {
  parseCustomerChatsAnalyticsQuery,
  type CustomerChatsAnalyticsQueryInput,
  type ParsedCustomerChatsAnalyticsQuery,
} from './customer-chats-analytics.util';

export type CustomerTopicsAnalyticsQueryInput = {
  from?: string;
  to?: string;
  granularity?: string;
  includePreview?: string;
  startedFrom?: string;
  topic?: string;
  /** `primary` = message charts use `topics.primaryTopic` only; `all` = labels with primary fallback (default). */
  messageTopicScope?: string;
  /** Which metric ranks `fastestGrowingTopics` (default `messages`). */
  growthMetric?: string;
};

export type ParsedCustomerTopicsAnalyticsQuery = ParsedCustomerChatsAnalyticsQuery & {
  topic?: TopicTaxonomyId;
  messageTopicScope: 'all' | 'primary';
  growthMetric: 'messages' | 'conversations';
};

export function parseCustomerTopicsAnalyticsQuery(
  input: CustomerTopicsAnalyticsQueryInput,
): ParsedCustomerTopicsAnalyticsQuery {
  const base = parseCustomerChatsAnalyticsQuery({
    from: input.from,
    to: input.to,
    granularity: input.granularity,
    includePreview: input.includePreview,
    startedFrom: input.startedFrom,
  } satisfies CustomerChatsAnalyticsQueryInput);

  let topic: TopicTaxonomyId | undefined;
  const tr = input.topic?.trim().toLowerCase();
  if (tr) {
    if (!TOPIC_TAXONOMY_ID_SET.has(tr)) {
      throw new BadRequestException({
        error: 'Invalid topic filter.',
        errorCode: 'INVALID_TOPIC_FILTER',
      });
    }
    topic = tr as TopicTaxonomyId;
  }

  let messageTopicScope: 'all' | 'primary' = 'all';
  const ms = input.messageTopicScope?.trim().toLowerCase();
  if (ms) {
    if (ms !== 'all' && ms !== 'primary') {
      throw new BadRequestException({
        error: 'Invalid messageTopicScope. Use "all" or "primary".',
        errorCode: 'INVALID_MESSAGE_TOPIC_SCOPE',
      });
    }
    messageTopicScope = ms as 'all' | 'primary';
  }

  let growthMetric: 'messages' | 'conversations' = 'messages';
  const gm = input.growthMetric?.trim().toLowerCase();
  if (gm) {
    if (gm !== 'messages' && gm !== 'conversations') {
      throw new BadRequestException({
        error: 'Invalid growthMetric. Use "messages" or "conversations".',
        errorCode: 'INVALID_GROWTH_METRIC',
      });
    }
    growthMetric = gm as 'messages' | 'conversations';
  }

  return { ...base, topic, messageTopicScope, growthMetric };
}

/** Stable topic key order for time series / breakdown fields. */
export const TOPIC_ANALYTICS_KEYS: readonly TopicTaxonomyId[] = TOPIC_TAXONOMY_IDS;
