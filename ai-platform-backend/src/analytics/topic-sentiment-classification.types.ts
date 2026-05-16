import type { SentimentLabel, TopicTaxonomyId } from './topic-sentiment-classification.constants';

/** Parsed + validated shape written to Message.topics / Message.sentiment */
export type SanitizedMessageClassification = {
  topics: {
    primaryTopic: TopicTaxonomyId;
    topicLabels: TopicTaxonomyId[];
    topicConfidence: number;
    primarySubTopic?: string;
    subTopicLabels?: string[];
  };
  sentiment: {
    label: SentimentLabel;
    score: number;
    reason?: string;
  };
};

export type ClassifiedUserMessageSlice = {
  createdAt: Date;
  primaryTopic?: string | null;
  topicLabels?: string[] | null;
  primarySubTopic?: string | null;
  subTopicLabels?: string[] | null;
  sentimentLabel?: string | null;
  sentimentScore?: number | null;
};

export type ConversationRollupResult = {
  conversationTopics: {
    primaryTopic: TopicTaxonomyId;
    topicLabels: TopicTaxonomyId[];
    primarySubTopic?: string;
    subTopicLabels?: string[];
  };
  conversationSentiment: {
    label: SentimentLabel;
    score?: number;
  };
};
