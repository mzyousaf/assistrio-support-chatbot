import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { FaqFromMessageForm } from './FaqFromMessageForm';

const FORM_ID = 'create-faq-from-message-form';

type Props = {
  open: boolean;
  onClose: () => void;
  botId: string;
  initialQuestion: string;
  initialAnswer: string;
};

export function CreateFaqFromMessageModal({
  open,
  onClose,
  botId,
  initialQuestion,
  initialAnswer,
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
      title="Add as FAQ"
      description="Review and edit before saving to your Q&A knowledge."
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
      <div className="flex flex-col gap-3">
        <p className="m-0 text-xs text-slate-500">Created from chat answer</p>
        <FaqFromMessageForm
          botId={botId}
          formId={FORM_ID}
          initialQuestion={initialQuestion}
          initialAnswer={initialAnswer}
          onSaved={onClose}
          onBusyChange={setBusy}
        />
      </div>
    </Modal>
  );
}
