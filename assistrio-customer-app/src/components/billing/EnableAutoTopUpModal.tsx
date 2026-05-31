import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
};

export function EnableAutoTopUpModal({ open, onClose, onConfirm, busy = false }: Props) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      allowDismiss={!busy}
      title="Enable auto top-up?"
      tone="default"
      description={
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          When monthly and existing top-up credits run out, Assistrio will automatically add 1,000
          AI credits and bill through Lemon Squeezy. You&apos;ll authorize billing in Lemon before
          auto top-up becomes active.
        </p>
      }
      children={null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? 'Opening checkout…' : 'Continue to Lemon Squeezy'}
          </Button>
        </div>
      }
    />
  );
}
