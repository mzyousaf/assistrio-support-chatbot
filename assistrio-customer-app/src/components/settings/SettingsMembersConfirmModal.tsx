import type { ReactNode } from 'react';
import { Button, Modal } from '@/components/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  tone?: 'default' | 'danger';
};

export function SettingsMembersConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  busy = false,
  busyLabel,
  tone = 'default',
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      allowDismiss={!busy}
      title={title}
      description={description}
      tone={tone === 'danger' ? 'danger' : 'default'}
      className="[&_[data-modal-body]]:hidden"
      children={null}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="sm"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? (busyLabel ?? `${confirmLabel}…`) : confirmLabel}
          </Button>
        </>
      }
    />
  );
}
