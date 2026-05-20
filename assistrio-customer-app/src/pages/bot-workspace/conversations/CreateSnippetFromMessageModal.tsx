import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { clampStrUtf8Bytes, KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES } from '@/lib/knowledgeContentUtf8Limits';
import { SnippetFromMessageForm } from './SnippetFromMessageForm';

const FORM_ID = 'create-snippet-from-message-form';

export function defaultSnippetTitleFromAnswer(answer: string): string {
  const t = answer.replace(/\s+/g, ' ').trim();
  if (!t) return 'Chat snippet';
  const clipped = t.length <= 60 ? t : `${t.slice(0, 57)}…`;
  return clampStrUtf8Bytes(clipped, KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES);
}

type Props = {
  open: boolean;
  onClose: () => void;
  botId: string;
  initialTitle: string;
  initialContent: string;
};

export function CreateSnippetFromMessageModal({
  open,
  onClose,
  botId,
  initialTitle,
  initialContent,
}: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      allowDismiss={!busy}
      title="Add as Snippet"
      description="Review and edit before saving to snippets."
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" size="sm" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </>
      }
    >
      <SnippetFromMessageForm
        botId={botId}
        formId={FORM_ID}
        initialTitle={initialTitle}
        initialContent={initialContent}
        onSaved={onClose}
        onBusyChange={setBusy}
      />
    </Modal>
  );
}
