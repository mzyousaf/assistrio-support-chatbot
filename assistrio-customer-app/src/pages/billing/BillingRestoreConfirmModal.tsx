import { SettingsMembersConfirmModal } from '@/components/settings/SettingsMembersConfirmModal';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
};

export function BillingRestoreConfirmModal({ open, onClose, onConfirm, busy = false }: Props) {
  return (
    <SettingsMembersConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      busy={busy}
      busyLabel="Restoring"
      confirmLabel="Restore subscription"
      tone="default"
      title="Restore subscription?"
      description={
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          This keeps your current plan active and removes the scheduled cancellation.
        </p>
      }
    />
  );
}
