import { SettingsMembersConfirmModal } from '@/components/settings/SettingsMembersConfirmModal';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
};

export function BillingDowngradePlanModal({ open, onClose, onConfirm, busy = false }: Props) {
  return (
    <SettingsMembersConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      busy={busy}
      busyLabel="Downgrading"
      confirmLabel="Downgrade to Starter"
      tone="default"
      title="Downgrade to Starter?"
      description={
        <div className="space-y-2 text-sm leading-relaxed text-slate-600">
          <p className="m-0">
            Your workspace limits will change to Starter after the downgrade is confirmed.
          </p>
          <ul className="m-0 list-disc space-y-1 pl-5">
            <li>500 AI credits/month</li>
            <li>5 members</li>
            <li>15 MB trained knowledge / bot</li>
          </ul>
        </div>
      }
    />
  );
}
