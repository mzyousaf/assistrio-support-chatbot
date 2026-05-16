import type { TopicTaxonomyId } from './topic-sentiment-classification.constants';
import { TOPIC_TAXONOMY_IDS } from './topic-sentiment-classification.constants';

/**
 * Map a trimmed lower-case string to taxonomy id (or `other` / null).
 * Expects variable `$$sLower` in scope (from parent $let).
 */
export const topicTaxonomySwitchOnSLower: Record<string, unknown> = {
  $switch: {
    branches: TOPIC_TAXONOMY_IDS.map((id: TopicTaxonomyId) => ({
      case: { $eq: ['$$sLower', id] },
      then: id,
    })),
    default: {
      $cond: [{ $gt: [{ $strLenCP: '$$sLower' }, 0] }, 'other', null],
    },
  },
};

/** Normalize one label element `$$lb` to taxonomy id or null. */
export const normalizeTopicLabelExpr: Record<string, unknown> = {
  $let: {
    vars: {
      sLower: {
        $toLower: {
          $trim: {
            input: { $toString: { $ifNull: ['$$lb', ''] } },
          },
        },
      },
    },
    in: topicTaxonomySwitchOnSLower,
  },
};

/** Normalize primary topic string to taxonomy id or null. */
export const normalizePrimaryTopicExpr: Record<string, unknown> = {
  $let: {
    vars: {
      sLower: {
        $toLower: {
          $trim: {
            input: { $toString: { $ifNull: ['$topics.primaryTopic', ''] } },
          },
        },
      },
    },
    in: topicTaxonomySwitchOnSLower,
  },
};

/**
 * Deduped taxonomy ids from `topics.topicLabels`, else `[primaryTopic]` when labels empty.
 * Unclassified messages use `[]`.
 */
export const messageTopicTagsExpr: Record<string, unknown> = {
  $let: {
    vars: {
      fromLabels: {
        $setUnion: [
          {
            $filter: {
              input: {
                $map: {
                  input: { $ifNull: ['$topics.topicLabels', []] },
                  as: 'lb',
                  in: normalizeTopicLabelExpr,
                },
              },
              as: 'x',
              cond: { $ne: ['$$x', null] },
            },
          },
          [],
        ],
      },
      primaryNorm: normalizePrimaryTopicExpr,
    },
    in: {
      $cond: [
        { $gt: [{ $size: '$$fromLabels' }, 0] },
        '$$fromLabels',
        {
          $cond: [{ $ne: ['$$primaryNorm', null] }, ['$$primaryNorm'], []],
        },
      ],
    },
  },
};

/** Only normalized `topics.primaryTopic` as 0–1 tags (ignore `topicLabels`). */
export const primaryOnlyMessageTopicTagsExpr: Record<string, unknown> = {
  $let: {
    vars: { pn: normalizePrimaryTopicExpr },
    in: {
      $cond: [{ $ne: ['$$pn', null] }, ['$$pn'], []],
    },
  },
};

/** Normalized `conversationTopics.primaryTopic` for conversation-level analytics (not message tags). */
export const conversationPrimaryTopicNormExpr: Record<string, unknown> = {
  $let: {
    vars: {
      sLower: {
        $toLower: {
          $trim: {
            input: { $toString: { $ifNull: ['$conversationTopics.primaryTopic', ''] } },
          },
        },
      },
    },
    in: topicTaxonomySwitchOnSLower,
  },
};
