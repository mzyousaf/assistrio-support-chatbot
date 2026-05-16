import type { CSSProperties } from 'react';
import { useCallback, useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChatUserVoiceMessage } from './ChatUserVoiceMessage';
import type { ConversationMessageUserBubbleStyle, ConversationMessageVoiceSpeechMeta } from './conversationMessageUi.types';

const BackIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

function VoiceHeaderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <rect x="3" y="10" width="2.5" height="4" rx="0.6" />
      <rect x="7.5" y="7" width="2.5" height="10" rx="0.6" />
      <rect x="12" y="9" width="2.5" height="6" rx="0.6" />
      <rect x="16.5" y="5" width="2.5" height="14" rx="0.6" />
    </svg>
  );
}

function CopyTranscriptControl({
  dark,
  transcript,
  copyLabel,
  copiedLabel,
  ariaLabelTranscriptHeading,
}: {
  dark: boolean;
  transcript: string;
  copyLabel: string;
  copiedLabel: string;
  ariaLabelTranscriptHeading: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (permissions, insecure context).
    }
  }, [transcript]);

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={cn(
        'shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2',
        dark
          ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 focus-visible:ring-gray-500/55'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-gray-400/50',
      )}
      aria-label={`${ariaLabelTranscriptHeading} — ${copyLabel}`}
    >
      <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
}

export function ChatVoiceMessageDetailScreen({
  dark = true,
  accentColor = '#6366f1',
  userVoiceBubbleStyle = 'primary',
  bubbleBorderRadius = 20,
  messageId = 'voice-detail',
  title,
  backLabel,
  speech,
  onBack,
  transcriptHeadingLabel = 'Transcript',
  copyTranscriptLabel = 'Copy',
  transcriptCopiedLabel = 'Copied!',
}: {
  dark?: boolean;
  accentColor?: string;
  userVoiceBubbleStyle?: ConversationMessageUserBubbleStyle;
  bubbleBorderRadius?: number;
  messageId?: string;
  title: string;
  backLabel: string;
  speech: ConversationMessageVoiceSpeechMeta;
  onBack: () => void;
  transcriptHeadingLabel?: string;
  copyTranscriptLabel?: string;
  transcriptCopiedLabel?: string;
}) {
  const transcriptHeadingId = useId();

  const onAccent = userVoiceBubbleStyle === 'primary' && Boolean(accentColor?.trim());
  const neutralBubbleBlack = userVoiceBubbleStyle === 'defaultDark';
  const userUsesPrimaryBubble = userVoiceBubbleStyle === 'primary';
  const userIsDefaultDark = userVoiceBubbleStyle === 'defaultDark';
  const radiusPx = Math.max(0, Math.min(32, bubbleBorderRadius));

  const bubbleSurfaceClass = cn(
    'chat-bubble-surface inline-block max-w-full min-w-0 align-top box-border px-3 py-2.5 text-left text-sm font-normal leading-relaxed',
    'break-words [overflow-wrap:anywhere]',
    userUsesPrimaryBubble && 'text-white',
    !userUsesPrimaryBubble && userIsDefaultDark && 'text-white bg-black border border-gray-600/80',
    !userUsesPrimaryBubble &&
      !userIsDefaultDark &&
      (dark
        ? 'text-gray-100 bg-gray-600/78 border border-gray-500/40'
        : 'text-gray-800 bg-gray-100 border border-gray-200/85'),
  );

  const bubbleInlineStyle: CSSProperties =
    userUsesPrimaryBubble && accentColor
      ? { backgroundColor: accentColor, color: '#fff', borderRadius: `${radiusPx}px` }
      : { borderRadius: `${radiusPx}px` };

  const url = (speech.audioUrl ?? '').trim();
  const transcript = (speech.transcript ?? '').trim();

  const transcriptBodyClass = cn(
    'w-full min-w-0 max-w-full text-left whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]',
    dark ? 'text-gray-300' : 'text-gray-800',
  );

  const transcriptLabelClass =
    'min-w-0 flex-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500';

  const playerWrapClass = 'self-start w-full min-w-0 max-w-[350px]';

  return (
    <div
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col',
        dark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-800',
      )}
    >
      <div
        className={cn(
          'relative flex min-h-[48px] shrink-0 items-center border-b px-2 py-2',
          dark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-gray-50/95',
        )}
      >
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors',
            dark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100',
          )}
          aria-label={backLabel}
        >
          <BackIcon />
        </button>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full items-center justify-center px-12">
          <div className="flex min-w-0 max-w-full items-center justify-center gap-2">
            <div
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full shadow-sm"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            >
              <VoiceHeaderIcon className="h-[16px] w-[16px] text-white" />
            </div>
            <h2
              className={cn(
                'min-w-0 max-w-full truncate text-center text-sm font-semibold',
                dark ? 'text-gray-100' : 'text-gray-900',
              )}
            >
              {title}
            </h2>
          </div>
        </div>
        <div className="z-0 ml-auto h-[30px] w-[30px] shrink-0" aria-hidden />
      </div>
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4',
          dark ? '[scrollbar-width:thin]' : '',
        )}
      >
        {url ? (
          <div className={playerWrapClass}>
            <div className={cn(bubbleSurfaceClass, 'block w-full min-w-0')} style={bubbleInlineStyle}>
              <ChatUserVoiceMessage
                messageId={messageId}
                audioUrl={url}
                durationMs={speech.durationMs}
                dark={dark}
                onAccent={onAccent}
                neutralBubbleBlack={neutralBubbleBlack}
                accentColor={accentColor}
                className="w-full min-w-0 !max-w-none"
              />
            </div>
          </div>
        ) : null}
        {url && transcript ? (
          <div
            role="separator"
            aria-hidden
            className={cn('h-px w-full min-w-0 shrink-0 rounded-full', dark ? 'bg-gray-600/80' : 'bg-gray-200')}
          />
        ) : null}
        {transcript ? (
          <section
            className="w-full min-w-0 max-w-full self-stretch text-left"
            aria-labelledby={transcriptHeadingId}
          >
            <div className="mb-2 flex min-w-0 max-w-full items-start justify-between gap-2">
              <p id={transcriptHeadingId} className={transcriptLabelClass}>
                {transcriptHeadingLabel}
              </p>
              <CopyTranscriptControl
                dark={dark}
                transcript={transcript}
                copyLabel={copyTranscriptLabel}
                copiedLabel={transcriptCopiedLabel}
                ariaLabelTranscriptHeading={transcriptHeadingLabel}
              />
            </div>
            <p className={transcriptBodyClass}>{transcript}</p>
          </section>
        ) : null}
        {!url && !transcript ? (
          <p className={cn('text-sm', dark ? 'text-gray-500' : 'text-gray-500')}>No voice data.</p>
        ) : null}
      </div>
    </div>
  );
}
