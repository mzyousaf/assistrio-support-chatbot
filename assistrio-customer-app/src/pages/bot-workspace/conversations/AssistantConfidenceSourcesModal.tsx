import { useEffect, useState } from 'react';
import { Bot, LibraryBig } from 'lucide-react';
import type { CustomerConversationMessageAiMeta, CustomerConversationMessageSource } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AssistantSourceItem } from './AssistantSourceItem';
import { AssistantTopSourceDetails } from './AssistantTopSourceDetails';
import {
  pickTopMatchedSource,
  sortSourcesByMatchScoreDesc,
  sourcesOtherThanTop,
} from './conversationTopSource';
import { retrievalScoreToConfidencePercent } from './formatSourceConfidenceScore';

export type AssistantConfidenceSourcesModalProps = {
  open: boolean;
  onClose: () => void;
  sources?: CustomerConversationMessageSource[] | null;
  aiMeta?: CustomerConversationMessageAiMeta;
};

type TabId = 'best' | 'other';

/** Below this normalized retrieval %, we do not list sources — reply is treated as general-model behaviour. */
const LOW_CONFIDENCE_HIDE_SOURCES_PCT = 10;

export function AssistantConfidenceSourcesModal({
  open,
  onClose,
  sources,
  aiMeta: _aiMeta,
}: AssistantConfidenceSourcesModalProps) {
  void _aiMeta;
  const [tab, setTab] = useState<TabId>('best');

  const list = sources?.filter(Boolean) ?? [];
  const sorted = list.length ? sortSourcesByMatchScoreDesc(list) : [];
  const top = list.length ? pickTopMatchedSource(list) : null;
  const others = sourcesOtherThanTop(sorted, top);

  const topPct =
    top?.score != null && typeof top.score === 'number' && Number.isFinite(top.score)
      ? retrievalScoreToConfidencePercent(top.score)
      : NaN;

  const hideSourcesForLowConfidence = Number.isFinite(topPct) && topPct < LOW_CONFIDENCE_HIDE_SOURCES_PCT;

  useEffect(() => {
    if (open) setTab('best');
  }, [open]);

  if (hideSourcesForLowConfidence) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={
          <>
            <Bot className="shrink-0 text-teal-600" size={22} strokeWidth={2} aria-hidden />
            <span>General bot behaviour</span>
          </>
        }
        titleClassName="flex flex-wrap items-center gap-2.5"
        description="This turn followed your bot’s default behaviour more than specific knowledge matches."
        size="lg"
        className="max-w-lg max-h-[min(92vh,40rem)]"
        closeOnBackdropClick
        bodyClassName="pb-3 pt-3 sm:px-5 sm:pb-3 sm:pt-3"
        footer={
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            Got it
          </Button>
        }
      >
        <ul className="m-0 list-none space-y-3 pl-0 text-sm leading-relaxed text-slate-700" role="list">
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600/90" aria-hidden />
            <span>This reply came mainly from your bot&apos;s general behaviour.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600/90" aria-hidden />
            <span>That reflects its default settings and how it&apos;s instructed to respond.</span>
          </li>
        </ul>
      </Modal>
    );
  }

  const n = sorted.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          <LibraryBig className="shrink-0 text-teal-600" size={22} strokeWidth={2} aria-hidden />
          <span>Sources & confidence</span>
        </>
      }
      titleClassName="flex flex-wrap items-center gap-2.5"
      description="Strongest retrieval match first; switch tabs to review supporting citations."
      size="lg"
      className="max-w-lg max-h-[min(92vh,44rem)]"
      closeOnBackdropClick
      bodyClassName="pb-3 pt-3 sm:px-5 sm:pb-3 sm:pt-3"
      footer={
        <Button type="button" variant="primary" size="sm" onClick={onClose}>
          Got it
        </Button>
      }
    >
      {n === 0 ? (
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          Source metadata was not stored for this message.
        </p>
      ) : (
        <>
          <div className="flex shrink-0 gap-1 border-b border-slate-100 pb-2">
            <button
              type="button"
              className={cn(
                'rounded-t-md border border-b-0 px-3 py-2 text-xs font-semibold transition',
                tab === 'best'
                  ? 'border-slate-200 bg-white text-teal-800'
                  : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700',
              )}
              onClick={() => setTab('best')}
            >
              Best match
            </button>
            <button
              type="button"
              className={cn(
                'rounded-t-md border border-b-0 px-3 py-2 text-xs font-semibold transition',
                tab === 'other'
                  ? 'border-slate-200 bg-white text-teal-800'
                  : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700',
              )}
              onClick={() => setTab('other')}
              disabled={others.length === 0}
            >
              Other sources{others.length ? ` (${others.length})` : ''}
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {tab === 'best' && top ? (
              <AssistantTopSourceDetails source={top} />
            ) : null}

            {tab === 'other' ? (
              others.length ? (
                <ul className="m-0 list-none space-y-2 pl-0" role="list">
                  {others.map((s, i) => (
                    <AssistantSourceItem key={`${s.chunkId ?? ''}-${s.knowledgeBaseItemId ?? ''}-${i}`} source={s} />
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-slate-600">No additional sources for this reply.</p>
              )
            ) : null}
          </div>
        </>
      )}
    </Modal>
  );
}
