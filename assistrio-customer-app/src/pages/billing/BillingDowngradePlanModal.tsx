import { SettingsMembersConfirmModal } from '@/components/settings/SettingsMembersConfirmModal';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  effectiveDate?: string | null;
};

export function BillingDowngradePlanModal({
  open,
  onClose,
  onConfirm,
  busy = false,
  effectiveDate,
}: Props) {
  const effectiveLabel = effectiveDate ? formatUsagePeriodDate(effectiveDate) : 'the end of your billing period';

  return (
    <SettingsMembersConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      busy={busy}
      busyLabel="Scheduling"
      confirmLabel="Schedule downgrade"
      tone="default"
      title="Downgrade to Starter?"
      description={
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          Your Pro features remain active until the end of the current billing period. Starter starts
          on {effectiveLabel}.
        </p>
      }
    />
  );
}
