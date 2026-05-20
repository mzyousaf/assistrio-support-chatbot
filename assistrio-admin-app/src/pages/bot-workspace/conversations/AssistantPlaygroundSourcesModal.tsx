import { LibraryBig } from 'lucide-react';
import type { AdminConversationMessageAiMeta, AdminConversationMessageSource } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import { AssistantSourcesUsedList } from './AssistantConfidenceSourcesModal';

export type AssistantPlaygroundSourcesModalProps = {
  open: boolean;
  onClose: () => void;
  sources?: AdminConversationMessageSource[] | null;
  aiMeta?: AdminConversationMessageAiMeta;
};

export function AssistantPlaygroundSourcesModal({
  open,
  onClose,
  sources,
  aiMeta,
}: AssistantPlaygroundSourcesModalProps) {
  void aiMeta;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          <LibraryBig className="shrink-0 text-teal-600" size={22} strokeWidth={2} aria-hidden />
          <span>Sources</span>
        </>
      }
      titleClassName="flex flex-wrap items-center gap-2.5"
      description="Knowledge used for this assistant reply."
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
