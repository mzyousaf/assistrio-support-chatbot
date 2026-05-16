import type { CustomerConversationListItem } from '@/api/types';
import { cn } from '@/lib/utils';
import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { Tooltip } from '@/components/ui';
import { ConversationMetricPill } from './ConversationMetricPill';
import { ConversationRollupTopicSentiment } from './ConversationRollupTopicSentiment';
import { ConversationStartedFromBadge } from './ConversationStartedFromBadge';

type Props = {
  conversation: CustomerConversationListItem;
  active: boolean;
  onSelect: (id: string) => void;
};

/** Same pill surface for every tag in the chat-log row (tag chrome only). */
const LIST_ROW_TAG_SURFACE = 'border-slate-200/85 bg-slate-100/95 text-slate-700';

export function ConversationListItem({ conversation: c, active, onSelect }: Props) {
  const main = (c.assistantPreview || '').trim() || (c.userPreview || '').trim() || '—';
  const secondary = (c.userPreview || '').trim();
  const abs = formatConversationAbsolute(c.lastActivityAt);
  const rel = formatConversationRelative(c.lastActivityAt);

  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      className={cn(
        'mb-1.5 w-full rounded-lg border px-3 py-2.5 text-left text-sm transition',
        active
          ? 'border-teal-500 bg-teal-50/50 shadow-sm ring-1 ring-teal-500/15'
          : 'border border-slate-200/90 bg-white hover:border-teal-300/85 hover:bg-teal-50/55',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="m-0 min-w-0 flex-1 line-clamp-2 font-medium leading-snug text-slate-900">{main}</p>
        <Tooltip content={abs} side="top" panelClassName="max-w-xs text-xs">
          <span className="shrink-0 cursor-default text-right text-[11px] font-medium tabular-nums text-slate-500">
            {rel}
          </span>
        </Tooltip>
      </div>
      {secondary ? (
        <p className="mt-1 line-clamp-1 text-xs leading-snug text-slate-600">{secondary}</p>
      ) : (
        <p className="mt-1 text-xs italic text-slate-400">No user message preview</p>
      )}
      <ConversationRollupTopicSentiment topics={c.conversationTopics} sentiment={c.conversationSentiment} className="mt-2" />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
        <ConversationStartedFromBadge startedFrom={c.startedFrom} className={LIST_ROW_TAG_SURFACE} />
        <ConversationMetricPill
          title="Total credits used in this conversation"
          className={LIST_ROW_TAG_SURFACE}
        >
          {c.totalCreditsUsed === 1 ? '1 AI Credit' : `${c.totalCreditsUsed} AI Credits`}
        </ConversationMetricPill>
        {c.hasLead ? (
          <ConversationMetricPill title="Lead captured in this conversation" className={LIST_ROW_TAG_SURFACE}>
            Lead
          </ConversationMetricPill>
        ) : null}
      </div>
    </button>
  );
}
