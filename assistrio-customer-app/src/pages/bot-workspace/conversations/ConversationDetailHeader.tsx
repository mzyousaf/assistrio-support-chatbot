import type { CustomerConversationDetail, CustomerConversationListItem } from '@/api/types';
import { formatConversationRelative } from '@/lib/conversationDateFormat';
import { ConversationRollupTopicSentiment } from './ConversationRollupTopicSentiment';
import { ConversationStartedFromBadge, formatStartedFromLabel } from './ConversationStartedFromBadge';

type Props = {
  listItem: CustomerConversationListItem;
  detail: CustomerConversationDetail | null;
};

export function ConversationDetailHeader({ listItem, detail }: Props) {
  const started = detail?.startedFrom ?? listItem.startedFrom ?? null;
  const sourceLabel = formatStartedFromLabel(started ?? undefined)?.trim() ?? '';
  const title = sourceLabel ? `Conversation ${sourceLabel}` : 'Conversation';
  const lastAt = detail?.lastActivityAt ?? listItem.lastActivityAt;
  const hasLead = detail?.hasLead ?? listItem.hasLead;

  return (
    <div className="min-w-0">
      <h2 className="m-0 line-clamp-3 break-words text-lg font-semibold leading-tight tracking-tight text-slate-900 sm:text-xl">
        {title}
      </h2>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
        <span className="min-w-0">
          Last activity{' '}
          <span className="font-medium text-slate-600">{formatConversationRelative(lastAt)}</span>
        </span>
        {started ? (
          <>
            <span className="select-none text-slate-300" aria-hidden>
              |
            </span>
            <ConversationStartedFromBadge startedFrom={started} className="max-w-[min(100%,14rem)]" />
          </>
        ) : null}
        {hasLead ? (
          <>
            <span className="select-none text-slate-300" aria-hidden>
              |
            </span>
            <span className="inline-flex shrink-0 rounded-full border border-teal-200/90 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
              Lead
            </span>
          </>
        ) : null}
      </div>
      {detail ? (
        <ConversationRollupTopicSentiment
          topics={detail.conversationTopics}
          sentiment={detail.conversationSentiment}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}
