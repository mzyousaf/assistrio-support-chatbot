import type { CustomerConversationMessageFeedback } from '@/api/types';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  assistantFooterPillClass,
  assistantWelcomeTagClass,
} from './assistantMessageFooterStyles';
import { AssistantMessageTimePill } from './AssistantMessageTimePill';
import { MessageFeedbackStatus } from './MessageFeedbackStatus';

const sourcesTagTooltip = 'Knowledge used for this assistant reply.';
const reviewAnswerTagTooltip =
  'Turn this assistant reply into reusable knowledge as Q&A or a snippet.';

export type AssistantMessageFooterVariant = 'default' | 'playground';

type Props = {
  createdAt: string;
  feedback?: CustomerConversationMessageFeedback | null;
  onReviseAnswer?: () => void;
  showRevise?: boolean;
  isWelcomeMessage?: boolean;
  /** Playground chat logs: welcome shows tag + time; others show Sources, Review Answer, and time pill. */
  variant?: AssistantMessageFooterVariant;
  onOpenSources?: () => void;
  className?: string;
};

export function AssistantMessageFooter({
  createdAt,
  feedback,
  onReviseAnswer,
  showRevise,
  isWelcomeMessage,
  variant = 'default',
  onOpenSources,
  className,
}: Props) {
  const playground = variant === 'playground';

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {playground && isWelcomeMessage ? (
          <>
            <span className={assistantWelcomeTagClass}>Welcome chat</span>
            <AssistantMessageTimePill createdAt={createdAt} />
          </>
        ) : null}
        {playground && !isWelcomeMessage ? (
          <Tooltip content={sourcesTagTooltip} side="top" panelClassName="max-w-xs text-xs">
            <button type="button" className={assistantFooterPillClass} onClick={onOpenSources}>
              Sources
            </button>
          </Tooltip>
        ) : null}
        {!playground && isWelcomeMessage ? (
          <span className={assistantWelcomeTagClass}>Welcome message</span>
        ) : null}
        {!isWelcomeMessage && showRevise && onReviseAnswer ? (
          <Tooltip content={reviewAnswerTagTooltip} side="top" panelClassName="max-w-xs text-xs">
            <button type="button" className={assistantFooterPillClass} onClick={onReviseAnswer}>
              Review Answer
            </button>
          </Tooltip>
        ) : null}
        {!isWelcomeMessage ? <AssistantMessageTimePill createdAt={createdAt} /> : null}
      </div>
      <MessageFeedbackStatus feedback={feedback} className="shrink-0" />
    </div>
  );
}
