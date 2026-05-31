import type { BillingInterval } from '@/api/types';
import { Button } from '@/components/ui';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

type Props = {
  open: boolean;
  itemLabel: string;
  currentInterval: BillingInterval;
  targetInterval: BillingInterval;
  effectiveDate?: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function BillingSwitchIntervalModal({
  open,
  effectiveDate,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  const effectiveLabel = effectiveDate ? formatUsagePeriodDate(effectiveDate) : null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-billing-interval-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="switch-billing-interval-title" className="m-0 text-lg font-semibold text-slate-900">
          Switch billing interval?
        </h2>
        <p className="m-0 mt-3 text-sm leading-relaxed text-slate-600">
          Your billing interval will switch on{' '}
          <span className="font-medium text-slate-800">
            {effectiveLabel ?? 'the end of your current billing period'}
          </span>
          . Your current billing period continues unchanged.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={busy} onClick={onConfirm}>
            {busy ? 'Scheduling…' : 'Schedule switch'}
          </Button>
        </div>
      </div>
    </div>
  );
}
