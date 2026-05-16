import { TOPIC_TAXONOMY_IDS } from './topic-sentiment-classification.taxonomy';

export {
  MAIN_TOPIC_SUBTOPICS,
  TOPIC_LABELS,
  TOPIC_TAXONOMY_IDS,
  type TopicTaxonomyId,
} from './topic-sentiment-classification.taxonomy';

export const TOPIC_TAXONOMY_ID_SET = new Set<string>(TOPIC_TAXONOMY_IDS);

export const SENTIMENT_LABELS = ['positive', 'neutral', 'negative', 'mixed', 'unknown'] as const;

export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];

export const SENTIMENT_LABEL_SET = new Set<string>(SENTIMENT_LABELS);

/** Default model; override with TOPIC_SENTIMENT_MODEL. */
export const TOPIC_SENTIMENT_DEFAULT_MODEL = 'gpt-4.1-mini';

export const TOPIC_SENTIMENT_MAX_INPUT_CHARS = 1000;

/** Reasons stored on Message.sentiment; customer serializers may omit or truncate further. */
export const TOPIC_SENTIMENT_REASON_MAX_CHARS = 80;

/** Minimum non-whitespace characters to call the classifier. */
export const TOPIC_SENTIMENT_MIN_CHARS_FOR_LLM = 2;

/** User messages considered for conversation rollup. */
export const TOPIC_SENTIMENT_ROLLUP_USER_MESSAGE_WINDOW = 20;

/** Max main topic labels stored on Message.topics */
export const TOPIC_LABELS_MAX_PER_MESSAGE = 3;

/** Max main topic labels on conversation summary */
export const TOPIC_LABELS_MAX_ON_CONVERSATION = 5;

/** Max sub-topic labels stored on Message.topics */
export const TOPIC_SUBTOPIC_LABELS_MAX_PER_MESSAGE = 5;

/** Max sub-topic labels on conversation summary */
export const TOPIC_SUBTOPIC_LABELS_MAX_ON_CONVERSATION = 8;
