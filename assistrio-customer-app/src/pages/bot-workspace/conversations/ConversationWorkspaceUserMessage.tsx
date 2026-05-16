import { FileText } from 'lucide-react';
import { useState } from 'react';
import type { CustomerConversationMessage } from '@/api/types';
import {
  AttachmentCountBadge,
  ChatUserVoiceMessage,
  ChatVoiceMessageDetailScreen,
  VoiceTranscriptPreview,
} from './conversation-message-ui';
import { Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { conversationMessageBodyText } from './conversationMessageText';
import { MessageCreditBadge, shouldShowMessageCreditBadge } from './MessageCreditBadge';
import { MessageCreditBreakdownModal } from './MessageCreditBreakdownModal';
import { MessageTopicSentimentTags, messageShouldShowTopicSentimentTags } from './MessageTopicSentimentTags';
import { WorkspaceMessageAttachmentsModal } from './WorkspaceMessageAttachmentsModal';

/** Mirrors chat-widget `ChatBubble` user rows: text, voice player + transcript, attachment count badge. */
export function ConversationWorkspaceUserMessage({ message }: { message: CustomerConversationMessage }) {
  const msgKey = message.messageId || message.id || `${message.createdAt}-user`;
  const si = message.speechInput;
  const isUserVoice =
    si?.mode === 'voice' && Boolean(typeof si.audioUrl === 'string' && si.audioUrl.trim());
  const voiceTranscript = si?.transcript?.trim() ?? '';
  const attachmentCount = message.attachments?.length ?? 0;

  const [voiceTranscriptOpen, setVoiceTranscriptOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [voiceDetailOpen, setVoiceDetailOpen] = useState(false);
  const [creditDetailsOpen, setCreditDetailsOpen] = useState(false);

  const textBody = conversationMessageBodyText(message).trim();

  /** No `chat-bubble-surface` — widget CSS uses `overflow-wrap:anywhere`, which splits short phrases oddly. */
  const bubbleSurfaceClass = cn(
    'inline-block max-w-full align-top box-border',
    'rounded-2xl border border-white/20 bg-[var(--color-primary)] px-3 py-2.5',
    'text-sm font-normal leading-relaxed text-[var(--color-primary-foreground)] shadow-sm',
    'break-words',
  );

  const plainTextClass =
    'whitespace-pre-wrap min-w-0 max-w-full text-left break-words text-[var(--color-primary-foreground)]';

  const voiceShowTranscriptLabel = 'Show transcript';
  const voiceHideTranscriptLabel = 'Hide transcript';

  const audioUrl = si?.audioUrl?.trim() ?? '';
  const isVoiceMessage = Boolean(isUserVoice && audioUrl);

  const showCredits = shouldShowMessageCreditBadge(message.creditCost, message.creditReason, message.creditBreakdown);
  const openCreditModal = showCredits ? () => setCreditDetailsOpen(true) : undefined;
  const creditBadge = showCredits ? (
    <button
      type="button"
      onClick={openCreditModal}
      className="cursor-pointer border-none bg-transparent p-0"
      aria-label="View credit breakdown for this message"
    >
      <MessageCreditBadge
        creditCost={message.creditCost}
        creditReason={message.creditReason}
        creditBreakdown={message.creditBreakdown}
        className="shrink-0"
      />
    </button>
  ) : null;
  const voiceToolbarVisible =
    Boolean(isUserVoice && audioUrl) &&
    (showCredits || Boolean(voiceTranscript) || attachmentCount > 0);

  const userTagsRowClass = 'mt-1 w-full min-w-0';
  const showTopicSentimentTags = messageShouldShowTopicSentimentTags(message);
  const showFooterMeta = showCredits || attachmentCount > 0;

  return (
    <>
      <div
        className={cn(
          'flex min-w-0 flex-col gap-0.5',
          isVoiceMessage
            ? 'box-border self-end w-[350px] min-w-[350px] max-w-[350px] items-stretch'
            : 'w-fit max-w-full items-end',
        )}
      >
        {isVoiceMessage ? (
          <div className="w-full max-w-full min-w-0 shrink-0">
            <div className={cn(bubbleSurfaceClass, 'block w-full min-w-0 box-border')} role="article">
              <ChatUserVoiceMessage
                messageId={msgKey}
                audioUrl={audioUrl}
                durationMs={si?.durationMs}
                disabled={false}
                dark
                onAccent
                accentColor="#14b8a6"
                className="w-full min-w-0 !max-w-none"
              />
            </div>
            {voiceToolbarVisible ? (
              <div className={userTagsRowClass}>
                {voiceTranscript && showCredits ? (
                  <div className="flex w-full min-w-0 max-w-full flex-nowrap items-center justify-between gap-1.5">
                    {creditBadge}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setVoiceTranscriptOpen((v) => !v)}
                        aria-expanded={voiceTranscriptOpen}
                        className={cn(
                          'group inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium focus:outline-none focus-visible:ring-2 rounded px-0.5 transition-colors duration-200',
                          'text-slate-600 hover:text-slate-800 focus-visible:ring-slate-400/50',
                        )}
                      >
                        <FileText className="size-3 shrink-0" strokeWidth={2} aria-hidden />
                        <span className="underline decoration-slate-400/80 underline-offset-[3px] group-hover:decoration-slate-600">
                          {voiceTranscriptOpen ? voiceHideTranscriptLabel : voiceShowTranscriptLabel}
                        </span>
                      </button>
                      {attachmentCount > 0 ? (
                        <AttachmentCountBadge
                          count={attachmentCount}
                          dark={false}
                          onClick={() => setAttachmentsOpen(true)}
                        />
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full min-w-0 max-w-full flex-nowrap items-center justify-end gap-1.5">
                    {showCredits ? creditBadge : null}
                    {voiceTranscript ? (
                      <button
                        type="button"
                        onClick={() => setVoiceTranscriptOpen((v) => !v)}
                        aria-expanded={voiceTranscriptOpen}
                        className={cn(
                          'group inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium focus:outline-none focus-visible:ring-2 rounded px-0.5 transition-colors duration-200',
                          'text-slate-600 hover:text-slate-800 focus-visible:ring-slate-400/50',
                        )}
                      >
                        <FileText className="size-3 shrink-0" strokeWidth={2} aria-hidden />
                        <span className="underline decoration-slate-400/80 underline-offset-[3px] group-hover:decoration-slate-600">
                          {voiceTranscriptOpen ? voiceHideTranscriptLabel : voiceShowTranscriptLabel}
                        </span>
                      </button>
                    ) : null}
                    {attachmentCount > 0 ? (
                      <AttachmentCountBadge
                        count={attachmentCount}
                        dark={false}
                        onClick={() => setAttachmentsOpen(true)}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
            {voiceTranscript ? (
              <div
                className={cn(
                  'grid w-full min-w-0 max-w-full transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                  voiceTranscriptOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  {voiceTranscriptOpen ? (
                    <VoiceTranscriptPreview
                      text={voiceTranscript}
                      dark
                      onSeeMore={() => setVoiceDetailOpen(true)}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
            {showTopicSentimentTags ? (
              <div className={userTagsRowClass}>
                <MessageTopicSentimentTags message={message} />
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className={cn(bubbleSurfaceClass, 'w-fit max-w-full')} role="article">
              {textBody ? (
                <p className={plainTextClass}>{textBody}</p>
              ) : (
                <span className="italic text-left text-[var(--color-primary-foreground)]/70">
                  Empty message
                </span>
              )}
            </div>
            {showFooterMeta || showTopicSentimentTags ? (
              <div className={userTagsRowClass}>
                <div
                  className={cn(
                    'flex w-full flex-wrap items-center gap-1.5',
                    showFooterMeta && showTopicSentimentTags ? 'justify-between' : 'justify-end',
                  )}
                >
                  {showTopicSentimentTags ? (
                    <MessageTopicSentimentTags
                      message={message}
                      className={cn('min-w-0', showFooterMeta ? 'flex-1 justify-start' : 'justify-end')}
                    />
                  ) : null}
                  {showFooterMeta ? (
                    <div
                      className={cn(
                        'flex shrink-0 flex-nowrap items-center gap-1.5',
                        showCredits && attachmentCount > 0 ? 'justify-between' : 'justify-end',
                      )}
                    >
                      {showCredits ? creditBadge : null}
                      {attachmentCount > 0 ? (
                        <AttachmentCountBadge
                          count={attachmentCount}
                          dark={false}
                          onClick={() => setAttachmentsOpen(true)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {attachmentCount > 0 ? (
        <WorkspaceMessageAttachmentsModal
          open={attachmentsOpen}
          onClose={() => setAttachmentsOpen(false)}
          attachments={message.attachments ?? []}
        />
      ) : null}

      {isUserVoice && si && audioUrl ? (
        <Modal
          open={voiceDetailOpen}
          onClose={() => setVoiceDetailOpen(false)}
          title=""
          hideHeader
          dialogAriaLabel="Voice message"
          size="lg"
          className="max-w-xl"
          closeOnBackdropClick
          bodyClassName="p-0 sm:p-0 overflow-hidden"
        >
          <div className="h-[min(480px,72vh)] min-h-[260px] w-full min-w-0 overflow-hidden rounded-md border border-slate-200 bg-slate-950">
            <ChatVoiceMessageDetailScreen
              dark
              accentColor="#14b8a6"
              userVoiceBubbleStyle="defaultDark"
              bubbleBorderRadius={16}
              messageId={msgKey}
              title="Voice message"
              backLabel="Close"
              speech={{
                mode: 'voice',
                audioUrl,
                transcript: voiceTranscript || undefined,
                durationMs: si.durationMs,
              }}
              onBack={() => setVoiceDetailOpen(false)}
            />
          </div>
        </Modal>
      ) : null}

      <MessageCreditBreakdownModal open={creditDetailsOpen} onClose={() => setCreditDetailsOpen(false)} message={message} />
    </>
  );
}
