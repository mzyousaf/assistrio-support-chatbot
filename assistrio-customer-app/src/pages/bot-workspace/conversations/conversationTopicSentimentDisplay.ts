import type { CustomerConversationMessage, CustomerSentimentLabelId, CustomerTopicsAnalyticsTopicId } from '@/api/types';
import { SENTIMENT_DISPLAY_FALLBACK } from '../analytics/sentiment/sentimentChartTheme';
import { TOPIC_DISPLAY_FALLBACK } from '../analytics/topics/topicTaxonomy';
import { capitalizeWordsFromKey } from './conversationInsightsFormatting';

/** Teal topic chip (message rows + topic modals). */
export const topicPillClass =
  'inline-flex max-w-full shrink-0 items-center gap-1 rounded-md border border-teal-200/75 bg-teal-50/85 px-1.5 py-0.5 text-[11px] font-medium leading-tight tracking-tight text-teal-900';

/**
 * Neutral chip shared by Insights **chat logs** row tags (Lead, primary topic, sentiment, credits)
 * so shape, padding, border, and type scale match.
 */
export const chatLogListChipClass =
  'inline-flex max-w-full min-h-[1.25rem] shrink-0 items-center gap-1 rounded-md border border-slate-200/90 bg-slate-50/98 px-2 py-0.5 text-[10px] font-medium leading-snug text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.04)]';

/** Muted chip for additional topic tags in modals. */
export const topicSecondaryPillClass =
  'inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-md border border-slate-200/85 bg-slate-50/90 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-slate-800';

export function topicTaxonomyCustomerLabel(rawId: string | undefined | null): string {
  const t = (rawId ?? '').trim();
  if (!t) return '';
  const k = t as CustomerTopicsAnalyticsTopicId;
  if (Object.prototype.hasOwnProperty.call(TOPIC_DISPLAY_FALLBACK, k)) {
    return TOPIC_DISPLAY_FALLBACK[k];
  }
  return capitalizeWordsFromKey(t.replace(/_/g, ' '));
}

export function sentimentTaxonomyCustomerLabel(raw: string | undefined | null): string {
  const k = (raw ?? '').trim().toLowerCase() as CustomerSentimentLabelId;
  if (k && Object.prototype.hasOwnProperty.call(SENTIMENT_DISPLAY_FALLBACK, k)) {
    return SENTIMENT_DISPLAY_FALLBACK[k];
  }
  return capitalizeWordsFromKey((raw ?? '').replace(/_/g, ' '));
}

export function formatSentimentScoreForDisplay(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  if (Object.is(r, -0)) return '0';
  return String(r);
}

const MESSAGE_SENTIMENT_TAG_LABELS = new Set(['positive', 'neutral', 'negative', 'mixed']);

export { MESSAGE_SENTIMENT_TAG_LABELS };

export function messageShouldShowTopicSentimentTags(message: CustomerConversationMessage): boolean {
  if ((message.role ?? '').toLowerCase() !== 'user') return false;
  const topics = message.topics;
  const sentiment = message.sentiment;
  const hasTopic =
    Boolean(topics?.primaryTopic?.trim()) ||
    Boolean(topics?.topicLabels?.some((l) => typeof l === 'string' && l.trim().length > 0));
  const sk = sentiment?.label?.trim().toLowerCase();
  const hasSentimentLabel = Boolean(sk && MESSAGE_SENTIMENT_TAG_LABELS.has(sk));
  return hasTopic || hasSentimentLabel;
}
