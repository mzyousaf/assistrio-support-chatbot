import { LibraryBig } from 'lucide-react';
import type { CustomerConversationMessageAiMeta, CustomerConversationMessageSource } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import { AssistantSourceItem } from './AssistantSourceItem';
import { sourcesForDisplay } from './conversationSourcesDisplay';

export type AssistantConfidenceSourcesModalProps = {
  open: boolean;
  onClose: () => void;
  sources?: CustomerConversationMessageSource[] | null;
  aiMeta?: CustomerConversationMessageAiMeta;
};

/** List body for modal and unit tests (no portal). */
export function AssistantSourcesUsedList({
  sources,
}: {
  sources?: CustomerConversationMessageSource[] | null;
}) {
  const sorted = sourcesForDisplay(sources);
  if (!sorted.length) {
    return (
      <p className="m-0 text-sm leading-relaxed text-slate-600">
        Source metadata was not stored for this message.
      </p>
    );
  }
  return (
    <ul className="m-0 list-none space-y-2 pl-0" role="list">
      {sorted.map((s, i) => (
        <AssistantSourceItem
          key={`${s.chunkId ?? ''}-${s.knowledgeBaseItemId ?? ''}-${i}`}
          source={s}
          index={i + 1}
        />
      ))}
    </ul>
  );
}

export function AssistantConfidenceSourcesModal({
  open,
  onClose,
  sources,
  aiMeta: _aiMeta,
}: AssistantConfidenceSourcesModalProps) {
  void _aiMeta;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          <LibraryBig className="shrink-0 text-teal-600" size={22} strokeWidth={2} aria-hidden />
          <span>Sources used</span>
        </>
      }
      titleClassName="flex flex-wrap items-center gap-2.5"
      description="These are the knowledge sources used to answer this message."
      size="lg"
      className="max-w-lg max-h-[min(92vh,44rem)]"
      closeOnBackdropClick
      bodyClassName="pb-3 pt-3 sm:px-5 sm:pb-3 sm:pt-3"
      footer={
        <Button type="button" variant="primary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <AssistantSourcesUsedList sources={sources} />
    </Modal>
  );
}
