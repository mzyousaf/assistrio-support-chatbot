import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  cancelAtPeriodEnd?: boolean;
};

export function DisableAutoTopUpModal({
  open,
  onClose,
  onConfirm,
  busy = false,
  cancelAtPeriodEnd = false,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      allowDismiss={!busy}
      title="Turn off auto top-up?"
      tone="default"
      description={
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          {cancelAtPeriodEnd
            ? 'Auto top-up is already scheduled to turn off at the end of the current billing period.'
            : 'No new automatic 1,000-credit packs will be added after you confirm. Your existing top-up credits remain available.'}
        </p>
      }
      children={null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            Keep auto top-up
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={busy || cancelAtPeriodEnd} onClick={() => void onConfirm()}>
            {busy ? 'Updating…' : 'Turn off auto top-up'}
          </Button>
        </div>
      }
    />
  );
}
