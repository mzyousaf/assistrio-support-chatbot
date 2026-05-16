import { useState } from 'react';
import type { CustomerConversationMessage } from '@/api/types';
import { AssistantConfidenceSourcesModal } from './AssistantConfidenceSourcesModal';
import { AssistantMessageFooter } from './AssistantMessageFooter';
import { conversationMessageBodyText } from './conversationMessageText';
import { MessageAttachmentPreview } from './MessageAttachmentPreview';
import { ConversationMessageTimestamp } from './ConversationMessageTimestamp';
import { ConversationWorkspaceUserMessage } from './ConversationWorkspaceUserMessage';
import { cn } from '@/lib/utils';

type Props = {
  message: CustomerConversationMessage;
  botId?: string | null;
  onReviseAnswer?: () => void;
  /** Transient emphasis (e.g. deep-linked from Leads). */
  highlighted?: boolean;
};

export function ConversationMessageBubble({ message, botId, onReviseAnswer, highlighted }: Props) {
  const role = (message.role ?? '').toLowerCase();
  const text = conversationMessageBodyText(message);
  const key = message.messageId || message.id || `${message.createdAt}-${message.role}`;
  const hasBot = Boolean(botId?.trim());
  const [confidenceOpen, setConfidenceOpen] = useState(false);

  const hi = Boolean(highlighted);
  const hiCls = hi
    ? 'ring-2 ring-teal-500/90 ring-offset-2 ring-offset-white transition-shadow duration-300 motion-reduce:transition-none'
    : '';

  if (role === 'assistant') {
    return (
      <div
        className={cn('mb-5 flex w-full justify-start rounded-2xl', hiCls)}
        data-message-id={key}
      >
        <div className="flex min-w-[350px] max-w-[min(100%,36rem)] flex-col items-stretch gap-0">
          <div className="w-full pb-3">
            <div className="relative w-full">
              <div className="relative w-full min-w-0 rounded-2xl border border-slate-200/80 bg-slate-100 px-3 py-2.5 pb-5 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                {text || <span className="italic text-slate-400">Empty message</span>}
              </div>
              <AssistantMessageFooter
                createdAt={message.createdAt}
                feedback={message.feedback}
                onReviseAnswer={hasBot ? onReviseAnswer : undefined}
                showRevise={hasBot}
                sources={message.sources}
                aiMeta={message.aiMeta}
                onOpenConfidenceModal={() => setConfidenceOpen(true)}
                className="absolute bottom-0 left-0 right-0 z-[2] translate-y-1/2 px-1 sm:px-2"
              />
            </div>
          </div>
          {message.attachments?.length ? (
            <MessageAttachmentPreview attachments={message.attachments} variant="assistant" className="mt-2 w-full" />
          ) : null}
          <AssistantConfidenceSourcesModal
            open={confidenceOpen}
            onClose={() => setConfidenceOpen(false)}
            sources={message.sources}
            aiMeta={message.aiMeta}
          />
        </div>
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div className={cn('mb-2.5 flex w-full justify-end rounded-2xl', hiCls)} data-message-id={key}>
        <div className="flex min-w-0 max-w-[min(100%,36rem)] shrink-0 flex-col items-end">
          <ConversationWorkspaceUserMessage message={message} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mb-2 flex w-full justify-center rounded-2xl', hiCls)} data-message-id={key}>
      <div className="max-w-[min(100%,36rem)] min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">
        <span className="font-semibold text-slate-500">{role || 'system'}</span>
        <div className="mt-1 whitespace-pre-wrap break-words text-left text-sm text-slate-800">{text || '—'}</div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px]">
          <ConversationMessageTimestamp createdAt={message.createdAt} align="start" variant="default" />
        </div>
      </div>
    </div>
  );
}
