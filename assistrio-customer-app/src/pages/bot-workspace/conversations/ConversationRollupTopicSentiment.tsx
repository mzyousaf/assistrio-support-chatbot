import { useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import type { CustomerConversationSentimentSummary, CustomerConversationTopicsSummary } from '@/api/types';
import { cn } from '@/lib/utils';
import { MESSAGE_SENTIMENT_TAG_LABELS, topicTaxonomyCustomerLabel } from './conversationTopicSentimentDisplay';
import { SentimentTag } from './MessageTopicSentimentTags';
import { TopicRollupDetailsModal } from './TopicRollupDetailsModal';

const primaryPillClass =
  'inline-flex max-w-full shrink-0 items-center gap-1 rounded-md border border-teal-200/75 bg-teal-50/85 px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight tracking-tight text-teal-900 transition-colors hover:border-teal-300/90 hover:bg-teal-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30';

type Props = {
  topics?: CustomerConversationTopicsSummary;
  sentiment?: CustomerConversationSentimentSummary;
  className?: string;
};

function rollupMainAndSubs(topics: CustomerConversationTopicsSummary | undefined): {
  mainId: string;
  subIds: string[];
} {
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
  const subIds = ordered.filter((id) => id !== mainId);
  return { mainId, subIds };
}

export function ConversationRollupTopicSentiment({ topics, sentiment, className }: Props) {
  const [open, setOpen] = useState(false);
  const { mainId, subIds } = useMemo(() => rollupMainAndSubs(topics), [topics]);

  const sk = sentiment?.label?.trim().toLowerCase() ?? '';
  const showSentiment = Boolean(sk && MESSAGE_SENTIMENT_TAG_LABELS.has(sk));
  const showPrimary = Boolean(mainId);
  const primaryLabel = showPrimary ? topicTaxonomyCustomerLabel(mainId) : '';

  if (!showPrimary && !showSentiment) return null;

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-1', className)}>
        {showPrimary ? (
          <button
            type="button"
            className={cn(primaryPillClass, 'cursor-pointer')}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Tag className="size-3 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
            <span className="min-w-0 truncate">{primaryLabel || mainId}</span>
          </button>
        ) : null}
        {showSentiment && sk ? <SentimentTag labelKey={sk} /> : null}
      </div>
      {showPrimary ? (
        <TopicRollupDetailsModal
          open={open}
          onClose={() => setOpen(false)}
          title="Chat topics"
          primaryTopicId={mainId}
          subTopicIds={subIds}
        />
      ) : null}
    </>
  );
}
