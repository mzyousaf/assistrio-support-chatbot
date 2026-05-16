import { useState } from 'react';
import type { CustomerConversationMessage, CustomerConversationMessageTopics } from '@/api/types';
import { Tooltip } from '@/components/ui';
import { Blend, Frown, Meh, Smile, Tag, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MESSAGE_SENTIMENT_TAG_LABELS,
  messageShouldShowTopicSentimentTags,
  sentimentTaxonomyCustomerLabel,
  topicPillClass,
  topicTaxonomyCustomerLabel,
} from './conversationTopicSentimentDisplay';
import { TopicRollupDetailsModal } from './TopicRollupDetailsModal';

const primaryTopicTriggerClass = cn(
  topicPillClass,
  'cursor-pointer border-teal-300/85 bg-teal-50/95 text-left shadow-sm transition-colors hover:border-teal-400/90 hover:bg-teal-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
);

function sentimentIcon(labelKey: string): LucideIcon {
  const k = labelKey.trim().toLowerCase();
  if (k === 'positive') return Smile;
  if (k === 'neutral') return Meh;
  if (k === 'negative') return Frown;
  if (k === 'mixed') return Blend;
  return Meh;
}

function sentimentPillClass(rawKey: string): string {
  const k = rawKey.trim().toLowerCase();
  if (k === 'positive') return 'border-emerald-200/75 bg-emerald-50/85 text-emerald-900';
  if (k === 'neutral') return 'border-slate-200/80 bg-slate-50/90 text-slate-800';
  if (k === 'negative') return 'border-rose-200/75 bg-rose-50/90 text-rose-900';
  if (k === 'mixed') return 'border-violet-200/75 bg-violet-50/90 text-violet-900';
  return 'border-slate-200/80 bg-slate-50 text-slate-700';
}

function messageMainAndSubs(topics: CustomerConversationMessageTopics | undefined): { mainId: string; subIds: string[] } {
  const primary = topics?.primaryTopic?.trim() ?? '';
  const raw = (topics?.topicLabels ?? [])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of raw) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  const mainId = primary || ordered[0] || '';
  if (!mainId) return { mainId: '', subIds: [] };
  return { mainId, subIds: ordered.filter((id) => id !== mainId) };
}

export function TopicTag({ topicId, className }: { topicId: string; className?: string }) {
  const label = topicTaxonomyCustomerLabel(topicId);
  if (!label) return null;
  return (
    <Tooltip
      side="top"
      panelClassName="max-w-[14rem] text-left text-xs"
      content={
        <>
          <span className="text-slate-400">Topic</span>
          <span className="mt-0.5 block font-medium text-slate-50">{label}</span>
        </>
      }
    >
      <span className={cn(topicPillClass, 'cursor-default', className)}>
        <Tag className="size-3 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
        {label}
      </span>
    </Tooltip>
  );
}

export function SentimentTag({
  labelKey,
  className,
}: {
  labelKey: string;
  className?: string;
}) {
  const display = sentimentTaxonomyCustomerLabel(labelKey);
  const SentimentIcon = sentimentIcon(labelKey);
  return (
    <Tooltip
      side="top"
      panelClassName="max-w-[14rem] text-left text-xs"
      content={
        <>
          <span className="text-slate-400">Sentiment</span>
          <span className="mt-0.5 block font-medium text-slate-50">{display}</span>
        </>
      }
    >
      <span
        className={cn(
          'inline-flex max-w-full shrink-0 cursor-default items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight tracking-tight',
          sentimentPillClass(labelKey),
          className,
        )}
      >
        <SentimentIcon className="size-3 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
        {display}
      </span>
    </Tooltip>
  );
}

export function MessageTopicSentimentTags({
  message,
  className,
}: {
  message: CustomerConversationMessage;
  className?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!messageShouldShowTopicSentimentTags(message)) return null;

  const { mainId, subIds } = messageMainAndSubs(message.topics);
  const sk = message.sentiment?.label?.trim().toLowerCase();
  const showSentiment = Boolean(sk && MESSAGE_SENTIMENT_TAG_LABELS.has(sk));
  const showPrimary = Boolean(mainId);

  return (
    <>
      <div className={cn('flex flex-wrap items-center justify-end gap-1', className)}>
        {showPrimary ? (
          <button
            type="button"
            className={primaryTopicTriggerClass}
            aria-haspopup="dialog"
            aria-expanded={detailsOpen}
            aria-label={`View topic details: ${topicTaxonomyCustomerLabel(mainId) || mainId}`}
            onClick={() => setDetailsOpen(true)}
          >
            <Tag className="size-3 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
            {topicTaxonomyCustomerLabel(mainId) || mainId}
          </button>
        ) : null}
        {showSentiment && sk ? <SentimentTag labelKey={sk} /> : null}
      </div>
      {showPrimary ? (
        <TopicRollupDetailsModal
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title="Topics for this message"
          primaryTopicId={mainId}
          subTopicIds={subIds}
        />
      ) : null}
    </>
  );
}

export { messageShouldShowTopicSentimentTags } from './conversationTopicSentimentDisplay';
