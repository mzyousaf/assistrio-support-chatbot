import { SettingsMembersConfirmModal } from '@/components/settings/SettingsMembersConfirmModal';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
};

export function BillingUpgradePlanModal({ open, onClose, onConfirm, busy = false }: Props) {
  return (
    <SettingsMembersConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      busy={busy}
      busyLabel="Upgrading"
      confirmLabel="Upgrade to Pro"
      tone="default"
      title="Upgrade to Pro?"
      description={
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          Your workspace will upgrade immediately. Lemon Squeezy will calculate any prorated charge
          automatically.
        </p>
      }
    />
  );
}
