import { useCallback, useEffect, useLayoutEffect, useRef, useState, Fragment } from 'react';
import type { CustomerConversationMessage } from '@/api/types';
import { Button } from '@/components/ui';
import { InlineLoader } from '@/components/PageLoader';
import { ConversationMessageBubble } from './ConversationMessageBubble';
import { defaultSnippetTitleFromAnswer } from './CreateSnippetFromMessageModal';
import { ReviseAnswerDrawer } from './ReviseAnswerDrawer';
import { safeClientString } from '@/lib/safeClientString';
import { conversationMessageBodyText, nearestPreviousUserMessageText } from './conversationMessageText';

type MsgState = 'idle' | 'loading' | 'ok' | 'error';

type ReviseTarget = {
  message: CustomerConversationMessage;
  previousUserText: string | null;
};

type Props = {
  messages: CustomerConversationMessage[] | null;
  msgState: MsgState;
  msgError: string;
  onRetryMessages: () => void;
  botId?: string | null;
  /** Change when the hosted conversation fetch identity changes (insights: selection / list refresh / retry). */
  scrollConversationVersion?: string;
  /** Scroll to and emphasize this message after load (insights deep link from Leads). */
  highlightMessageId?: string | null;
};

export function ConversationMessageList({
  messages,
  msgState,
  msgError,
  onRetryMessages,
  botId,
  scrollConversationVersion,
  highlightMessageId,
}: Props) {
  const [reviseTarget, setReviseTarget] = useState<ReviseTarget | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [emphasizeMessageId, setEmphasizeMessageId] = useState<string | null>(null);
  const highlightDoneRef = useRef<string>('');

  const scrollTranscriptToBottom = useCallback(() => {
    scrollEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, []);

  const suppressBottomScroll = Boolean(highlightMessageId?.trim());

  useEffect(() => {
    if (!highlightMessageId?.trim()) {
      highlightDoneRef.current = '';
      setEmphasizeMessageId(null);
    }
  }, [highlightMessageId]);

  useLayoutEffect(() => {
    if (suppressBottomScroll) return;
    if (scrollConversationVersion == null || scrollConversationVersion === '') return;
    if (msgState !== 'ok' || !messages?.length) return;

    scrollTranscriptToBottom();
    let innerId = 0;
    const outerId = requestAnimationFrame(() => {
      scrollTranscriptToBottom();
      innerId = requestAnimationFrame(scrollTranscriptToBottom);
    });
    return () => {
      cancelAnimationFrame(outerId);
      cancelAnimationFrame(innerId);
    };
  }, [scrollConversationVersion, msgState, messages?.length, scrollTranscriptToBottom, suppressBottomScroll]);

  useEffect(() => {
    if (suppressBottomScroll) return;
    if (scrollConversationVersion == null || scrollConversationVersion === '') return;
    if (msgState !== 'ok' || !messages?.length) return;
    const t = window.setTimeout(scrollTranscriptToBottom, 0);
    const t2 = window.setTimeout(scrollTranscriptToBottom, 120);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [scrollConversationVersion, msgState, messages?.length, scrollTranscriptToBottom, suppressBottomScroll]);

  useLayoutEffect(() => {
    const id = highlightMessageId?.trim();
    if (!id || msgState !== 'ok' || !messages?.length) return;
    const ver = scrollConversationVersion ?? '';
    const marker = `${ver}:${id}`;
    if (highlightDoneRef.current === marker) return;
    const found = messages.some((m) => String(m.messageId || m.id || '') === id);
    if (!found) return;
    highlightDoneRef.current = marker;
    setEmphasizeMessageId(id);
    const clearT = window.setTimeout(() => setEmphasizeMessageId(null), 4200);
    let raf = 0;
    raf = requestAnimationFrame(() => {
      const nodes = document.querySelectorAll('[data-message-id]');
      let target: HTMLElement | null = null;
      for (const n of nodes) {
        if (n.getAttribute('data-message-id') === id) {
          target = n as HTMLElement;
          break;
        }
      }
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clearT);
    };
  }, [highlightMessageId, msgState, messages, scrollConversationVersion]);

  const openRevise = useCallback((message: CustomerConversationMessage, index: number) => {
    if (!messages) return;
    setReviseTarget({
      message,
      previousUserText: nearestPreviousUserMessageText(messages, index),
    });
  }, [messages]);

  if (msgState === 'loading') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <InlineLoader title="Loading conversation…" />
      </div>
    );
  }

  if (msgState === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center" role="alert">
        <p className="m-0 text-sm font-medium text-slate-800">Couldn&apos;t load messages</p>
        {msgError ? (
          <p className="m-0 max-w-md break-words text-xs text-slate-500">{safeClientString(msgError)}</p>
        ) : null}
        <Button type="button" variant="outlinePrimary" size="sm" onClick={onRetryMessages}>
          Retry
        </Button>
      </div>
    );
  }

  if (msgState === 'ok' && messages && messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center" role="status">
        <p className="m-0 text-sm font-medium text-slate-700">No messages in this conversation yet.</p>
      </div>
    );
  }

  if (msgState === 'ok' && messages) {
    const safeBotId = botId?.trim() ? botId.trim() : '';
    const answerText = reviseTarget ? conversationMessageBodyText(reviseTarget.message) : '';
    return (
      <Fragment>
        <div className="mt-auto flex min-w-0 w-full flex-col">
          {messages.map((m, index) => (
            <ConversationMessageBubble
              key={m.messageId || m.id || `${m.createdAt}-${m.role}-${index}`}
              message={m}
              botId={safeBotId || null}
              highlighted={
                emphasizeMessageId != null && String(m.messageId || m.id || '') === emphasizeMessageId
              }
              onReviseAnswer={
                safeBotId && (m.role ?? '').toLowerCase() === 'assistant'
                  ? () => openRevise(m, index)
                  : undefined
              }
            />
          ))}
          <div ref={scrollEndRef} className="h-px w-full shrink-0 scroll-mt-2" aria-hidden />
        </div>
        {/* <div aria-hidden className="pointer-events-none h-[6rem] w-full shrink-0 select-none sm:h-[5.5rem]" /> */}
        {safeBotId ? (
          <ReviseAnswerDrawer
            key={reviseTarget?.message.messageId ?? reviseTarget?.message.id ?? 'closed'}
            open={reviseTarget != null}
            onClose={() => setReviseTarget(null)}
            botId={safeBotId}
            initialQuestion={reviseTarget?.previousUserText ?? ''}
            initialAnswer={answerText}
            initialQaTitle={reviseTarget ? defaultSnippetTitleFromAnswer(answerText) : ''}
            initialSnippetTitle={reviseTarget ? defaultSnippetTitleFromAnswer(answerText) : ''}
          />
        ) : null}
      </Fragment>
    );
  }

  return null;
}
