import type {
  CustomerConversationMessageAiMeta,
  CustomerConversationMessageFeedback,
  CustomerConversationMessageSource,
} from '@/api/types';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { AssistantRetrievalConfidencePill } from './AssistantRetrievalConfidencePill';
import { MessageFeedbackStatus } from './MessageFeedbackStatus';
import { pickTopMatchedSource } from './conversationTopSource';

type Props = {
  createdAt: string;
  feedback?: CustomerConversationMessageFeedback | null;
  onReviseAnswer?: () => void;
  showRevise?: boolean;
  sources?: CustomerConversationMessageSource[] | null;
  aiMeta?: CustomerConversationMessageAiMeta;
  onOpenConfidenceModal?: () => void;
  className?: string;
};

const pillNeutral =
  'inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200/85 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-teal-200/90 hover:bg-teal-50/45 active:bg-teal-50/70 disabled:pointer-events-none disabled:opacity-40';

export function AssistantMessageFooter({
  createdAt,
  feedback,
  onReviseAnswer,
  showRevise,
  sources,
  aiMeta: _aiMeta,
  onOpenConfidenceModal,
  className,
}: Props) {
  void _aiMeta;
  const list = sources?.filter(Boolean) ?? [];
  const top = list.length ? pickTopMatchedSource(list) : null;

  const absTime = formatConversationAbsolute(createdAt);

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {onOpenConfidenceModal ? (
          <AssistantRetrievalConfidencePill score={top?.score} onClick={onOpenConfidenceModal} />
        ) : null}
        {showRevise && onReviseAnswer ? (
          <button type="button" className={pillNeutral} onClick={onReviseAnswer}>
            Review Answer
          </button>
        ) : null}
        <Tooltip content={absTime} side="top" panelClassName="max-w-xs text-xs">
          <span className="inline-flex shrink-0 cursor-default items-center rounded-md border border-slate-200/85 bg-white px-2 py-0.5 text-slate-600 shadow-sm">
            {formatConversationRelative(createdAt)}
          </span>
        </Tooltip>
      </div>
      <MessageFeedbackStatus feedback={feedback} className="shrink-0" />
    </div>
  );
}
