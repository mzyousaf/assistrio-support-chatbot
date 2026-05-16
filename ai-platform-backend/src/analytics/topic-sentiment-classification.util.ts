import {
  SENTIMENT_LABEL_SET,
  TOPIC_LABELS_MAX_ON_CONVERSATION,
  TOPIC_LABELS_MAX_PER_MESSAGE,
  TOPIC_SENTIMENT_REASON_MAX_CHARS,
  TOPIC_SUBTOPIC_LABELS_MAX_ON_CONVERSATION,
  TOPIC_SUBTOPIC_LABELS_MAX_PER_MESSAGE,
  TOPIC_TAXONOMY_ID_SET,
  type SentimentLabel,
  type TopicTaxonomyId,
} from './topic-sentiment-classification.constants';
import { narrowPrimarySubTopic, narrowSubTopicLabelArray } from './topic-sentiment-classification.subtopics';
import type {
  ClassifiedUserMessageSlice,
  ConversationRollupResult,
  SanitizedMessageClassification,
} from './topic-sentiment-classification.types';

const FALLBACK_TOPIC: TopicTaxonomyId = 'other';
const FALLBACK_SENTIMENT_LABEL: SentimentLabel = 'unknown';

export function narrowTopicId(raw: unknown): TopicTaxonomyId {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/\s+/g, '_') : '';
  if (!s || !TOPIC_TAXONOMY_ID_SET.has(s)) return FALLBACK_TOPIC;
  return s as TopicTaxonomyId;
}

export function narrowTopicLabelArray(raw: unknown, primary: TopicTaxonomyId): TopicTaxonomyId[] {
  const arr = Array.isArray(raw) ? raw : [];
  const set = new Set<TopicTaxonomyId>();
  set.add(primary);
  for (const x of arr) {
    const t = narrowTopicId(x);
    set.add(t);
    if (set.size >= TOPIC_LABELS_MAX_PER_MESSAGE) break;
  }
  return [...set].slice(0, TOPIC_LABELS_MAX_PER_MESSAGE);
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function clampNeg1To1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(-1, n));
}

export function sanitizeSentimentReason(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  let s = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!s) return undefined;
  s = s.replace(/^["']|["']$/g, '').trim();
  s = s.slice(0, TOPIC_SENTIMENT_REASON_MAX_CHARS);
  return s || undefined;
}

export function narrowSentimentLabel(raw: unknown): SentimentLabel {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!s || !SENTIMENT_LABEL_SET.has(s)) return FALLBACK_SENTIMENT_LABEL;
  return s as SentimentLabel;
}

/**
 * Map sensitive or off-taxonomy model outputs: if primary is not in allowlist it's already `other`;
 * `general_question` is used when the model signals generic/sensitive content via those strings in topic field.
 */
export function normalizePrimaryTopicFromLlm(primary: TopicTaxonomyId, topicLabels: TopicTaxonomyId[]): TopicTaxonomyId {
  let p = primary;
  const combined = [p, ...topicLabels].join(' ').toLowerCase();
  const sensitiveHints =
    /\b(health|medical|diagnos|race|religion|politic|sexual|orientation|criminal)\b/i.test(combined) ||
    /\b(ssn|social\s*security|passport)\b/i.test(combined);
  if (sensitiveHints && p !== 'general_question' && p !== 'other') {
    return 'general_question';
  }
  return p;
}

export function sanitizeLlmClassificationPayload(input: Record<string, unknown>): SanitizedMessageClassification {
  const rawPrimary = String(input.primaryTopic ?? '');
  const rawLabelsJoined = Array.isArray(input.topicLabels)
    ? (input.topicLabels as unknown[])
        .map((x) => String(x ?? ''))
        .join(' ')
        .toLowerCase()
    : '';
  const rawCombined = `${rawPrimary} ${rawLabelsJoined}`.toLowerCase();
  const rawSensitive =
    /\b(health|medical|diagnos|race|religion|politic|sexual|orientation|criminal)\b/i.test(rawCombined) ||
    /\b(ssn|social\s*security|passport)\b/i.test(rawCombined);

  const primaryRaw = rawSensitive ? 'general_question' : narrowTopicId(input.primaryTopic);
  const labelsRaw = narrowTopicLabelArray(input.topicLabels, primaryRaw);
  let primary = normalizePrimaryTopicFromLlm(primaryRaw, labelsRaw);
  const topicLabels = narrowTopicLabelArray(labelsRaw, primary);
  if (!topicLabels.includes(primary)) {
    topicLabels.unshift(primary);
  }
  const limitedLabels = topicLabels.slice(0, TOPIC_LABELS_MAX_PER_MESSAGE);
  const topicConfidence = clamp01(
    typeof input.topicConfidence === 'number'
      ? input.topicConfidence
      : Number(input.topicConfidence ?? 0),
  );

  const mainsOrdered: TopicTaxonomyId[] = [...new Set(limitedLabels)] as TopicTaxonomyId[];
  const primarySubTopic = narrowPrimarySubTopic(input.primarySubTopic, primary);
  let subTopicLabels = narrowSubTopicLabelArray(
    input.subTopicLabels,
    mainsOrdered,
    TOPIC_SUBTOPIC_LABELS_MAX_PER_MESSAGE,
  );
  if (primarySubTopic && !subTopicLabels.includes(primarySubTopic)) {
    subTopicLabels = [primarySubTopic, ...subTopicLabels].slice(0, TOPIC_SUBTOPIC_LABELS_MAX_PER_MESSAGE);
  }

  const sentRaw = input.sentiment;
  const sentObj =
    sentRaw && typeof sentRaw === 'object' && !Array.isArray(sentRaw) ? (sentRaw as Record<string, unknown>) : {};

  let label = narrowSentimentLabel(sentObj.label);
  let score = clampNeg1To1(
    typeof sentObj.score === 'number' ? sentObj.score : Number(sentObj.score ?? 0),
  );

  if (label === FALLBACK_SENTIMENT_LABEL && Number.isFinite(score) && score !== 0) {
    if (score <= -0.25) label = 'negative';
    else if (score >= 0.25) label = 'positive';
    else label = 'neutral';
  }

  const reason = sanitizeSentimentReason(sentObj.reason);

  const topics: SanitizedMessageClassification['topics'] = {
    primaryTopic: primary,
    topicLabels: limitedLabels,
    topicConfidence,
    ...(primarySubTopic ? { primarySubTopic } : {}),
    ...(subTopicLabels.length ? { subTopicLabels } : {}),
  };

  return {
    topics,
    sentiment: { label, score, reason },
  };
}

export function fallbackClassificationForShortOrEmptyInput(): SanitizedMessageClassification {
  return {
    topics: {
      primaryTopic: FALLBACK_TOPIC,
      topicLabels: [FALLBACK_TOPIC],
      topicConfidence: 0,
    },
    sentiment: { label: FALLBACK_SENTIMENT_LABEL, score: 0, reason: undefined },
  };
}

function isFiniteScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function rollupPrimarySubTopicFromMessages(withTopic: ClassifiedUserMessageSlice[]): string | undefined {
  const freq = new Map<string, number>();
  for (const m of withTopic) {
    const pm = narrowTopicId(m.primaryTopic);
    const psub = narrowPrimarySubTopic(m.primarySubTopic, pm);
    if (!psub) continue;
    freq.set(psub, (freq.get(psub) ?? 0) + 1);
  }
  if (!freq.size) return undefined;
  let maxCount = 0;
  for (const c of freq.values()) maxCount = Math.max(maxCount, c);
  const candidates = [...freq.entries()].filter(([, c]) => c === maxCount).map(([k]) => k);
  let pick = candidates[0];
  if (candidates.length > 1) {
    for (let i = withTopic.length - 1; i >= 0; i--) {
      const pm = narrowTopicId(withTopic[i].primaryTopic);
      const psub = narrowPrimarySubTopic(withTopic[i].primarySubTopic, pm);
      if (psub && candidates.includes(psub)) {
        pick = psub;
        break;
      }
    }
  }
  return pick;
}

function rollupConversationSubTopicLabelsFromMessages(
  withTopic: ClassifiedUserMessageSlice[],
  convPrimarySub?: string,
): string[] {
  const freq = new Map<string, number>();
  for (const m of withTopic) {
    const pm = narrowTopicId(m.primaryTopic);
    const mains: TopicTaxonomyId[] = [pm, ...narrowTopicLabelArray(m.topicLabels, pm)];
    const uniq = [...new Set(mains)] as TopicTaxonomyId[];
    const row = new Set<string>();
    const psub = narrowPrimarySubTopic(m.primarySubTopic, pm);
    if (psub) row.add(psub);
    for (const s of narrowSubTopicLabelArray(m.subTopicLabels, uniq, TOPIC_SUBTOPIC_LABELS_MAX_PER_MESSAGE)) {
      row.add(s);
    }
    for (const s of row) {
      freq.set(s, (freq.get(s) ?? 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  let out = sorted.slice(0, TOPIC_SUBTOPIC_LABELS_MAX_ON_CONVERSATION);
  if (convPrimarySub && !out.includes(convPrimarySub)) {
    out = [convPrimarySub, ...out].slice(0, TOPIC_SUBTOPIC_LABELS_MAX_ON_CONVERSATION);
  }
  return out;
}

export function rollupConversationTopicSentimentFromUserMessages(
  messagesOldestFirst: ClassifiedUserMessageSlice[],
): ConversationRollupResult | null {
  const withTopic = messagesOldestFirst.filter(
    (m) => m.primaryTopic != null && String(m.primaryTopic).trim() !== '',
  );
  const classifiedAny = messagesOldestFirst.filter((m) => {
    const hasTopic = m.primaryTopic != null && String(m.primaryTopic).trim() !== '';
    const hasSent =
      isFiniteScore(m.sentimentScore) ||
      (m.sentimentLabel != null && String(m.sentimentLabel).trim() !== '');
    return hasTopic || hasSent;
  });
  if (!classifiedAny.length) return null;

  let primaryTopic: TopicTaxonomyId = FALLBACK_TOPIC;
  let topicLabels: TopicTaxonomyId[] = [FALLBACK_TOPIC];

  if (withTopic.length) {
    const freq = new Map<TopicTaxonomyId, number>();
    const labelFreq = new Map<string, number>();
    for (const m of withTopic) {
      const pt = narrowTopicId(m.primaryTopic);
      freq.set(pt, (freq.get(pt) ?? 0) + 1);
      const tls = Array.isArray(m.topicLabels) ? m.topicLabels : [];
      for (const x of tls) {
        const t = narrowTopicId(x);
        labelFreq.set(t, (labelFreq.get(t) ?? 0) + 1);
      }
    }
    let maxCount = 0;
    for (const c of freq.values()) maxCount = Math.max(maxCount, c);
    const candidates = [...freq.entries()].filter(([, c]) => c === maxCount).map(([k]) => k);
    primaryTopic = candidates[0] ?? FALLBACK_TOPIC;
    if (candidates.length > 1) {
      for (let i = withTopic.length - 1; i >= 0; i--) {
        const p = withTopic[i].primaryTopic ? narrowTopicId(withTopic[i].primaryTopic) : null;
        if (p && candidates.includes(p)) {
          primaryTopic = p;
          break;
        }
      }
    }
    const unionScores = new Map<TopicTaxonomyId, number>();
    for (const [k, v] of freq.entries()) unionScores.set(k, v);
    for (const [k, v] of labelFreq.entries()) {
      unionScores.set(k as TopicTaxonomyId, (unionScores.get(k as TopicTaxonomyId) ?? 0) + v);
    }
    const sortedLabels = [...unionScores.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([k]) => k)
      .filter((k, i, a) => a.indexOf(k) === i)
      .slice(0, TOPIC_LABELS_MAX_ON_CONVERSATION);
    topicLabels = sortedLabels.length > 0 ? sortedLabels : [primaryTopic];
  }

  const primarySubTopic = withTopic.length ? rollupPrimarySubTopicFromMessages(withTopic) : undefined;
  const subTopicLabels = withTopic.length
    ? rollupConversationSubTopicLabelsFromMessages(withTopic, primarySubTopic)
    : [];

  const conversationTopics: ConversationRollupResult['conversationTopics'] = {
    primaryTopic,
    topicLabels,
    ...(primarySubTopic ? { primarySubTopic } : {}),
    ...(subTopicLabels.length ? { subTopicLabels } : {}),
  };

  const withSentiment = classifiedAny.filter(
    (m) =>
      isFiniteScore(m.sentimentScore) ||
      (m.sentimentLabel != null && String(m.sentimentLabel).trim() !== ''),
  );

  if (!withSentiment.length) {
    return {
      conversationTopics,
      conversationSentiment: { label: FALLBACK_SENTIMENT_LABEL },
    };
  }

  const scores: number[] = [];
  let posC = 0;
  let negC = 0;
  let neuC = 0;
  let mixC = 0;

  for (const m of withSentiment) {
    if (isFiniteScore(m.sentimentScore)) scores.push(clampNeg1To1(m.sentimentScore));
    const sl = m.sentimentLabel ? narrowSentimentLabel(m.sentimentLabel) : FALLBACK_SENTIMENT_LABEL;
    if (sl === 'positive') posC += 1;
    else if (sl === 'negative') negC += 1;
    else if (sl === 'neutral') neuC += 1;
    else if (sl === 'mixed') mixC += 1;
  }

  const avg =
    scores.length > 0 ? scores.reduce((s, x) => s + x, 0) / scores.length : NaN;

  let label: SentimentLabel;
  if (mixC >= 1 || (posC >= 1 && negC >= 1)) {
    label = 'mixed';
  } else if (Number.isFinite(avg)) {
    if (avg <= -0.25) label = 'negative';
    else if (avg >= 0.25) label = 'positive';
    else label = 'neutral';
  } else if (posC > 0 && negC === 0 && neuC === 0 && mixC === 0) {
    label = 'positive';
  } else if (negC > 0 && posC === 0 && neuC === 0 && mixC === 0) {
    label = 'negative';
  } else if (neuC > 0 && posC === 0 && negC === 0 && mixC === 0) {
    label = 'neutral';
  } else {
    label = 'neutral';
  }

  return {
    conversationTopics,
    conversationSentiment: {
      label,
      ...(Number.isFinite(avg) ? { score: Math.round(avg * 1000) / 1000 } : {}),
    },
  };
}

export function parseTopicSentimentJsonFromModelText(raw: string): Record<string, unknown> | null {
  const t = String(raw || '').trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t);
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const o = JSON.parse(m[0]);
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}
