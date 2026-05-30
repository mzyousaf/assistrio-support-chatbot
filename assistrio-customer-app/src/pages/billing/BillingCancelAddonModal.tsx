import { Button } from '@/components/ui';

type Props = {
  open: boolean;
  addonName: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function BillingCancelAddonModal({ open, addonName, busy = false, onClose, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-addon-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cancel-addon-title" className="m-0 text-lg font-semibold text-slate-900">
          Cancel add-on
        </h2>
        <p className="m-0 mt-3 text-sm leading-relaxed text-slate-600">
          Cancel <span className="font-medium text-slate-800">{addonName}</span>? This add-on remains
          active until the end of the current billing period.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            Keep add-on
          </Button>
          <Button type="button" variant="danger" size="sm" disabled={busy} onClick={onConfirm}>
            {busy ? 'Cancelling…' : 'Cancel add-on'}
          </Button>
        </div>
      </div>
    </div>
  );
}
