import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  currentPlanKey: string;
  portalLoading?: boolean;
  onContinueToPortal: () => void | Promise<void>;
  onDowngradeToStarter?: () => void;
};

export function BillingBeforeCancelModal({
  open,
  onClose,
  currentPlanKey,
  portalLoading = false,
  onContinueToPortal,
  onDowngradeToStarter,
}: Props) {
  const showDowngrade = currentPlanKey === 'pro' && onDowngradeToStarter != null;
  const description = showDowngrade
    ? 'You can downgrade to Starter instead of cancelling. If you cancel, your paid access remains active until the end of the billing period. Cancellation is managed securely in Lemon Squeezy.'
    : 'Your paid access remains active until the end of the billing period. Cancellation is managed securely in Lemon Squeezy.';

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!portalLoading) onClose();
      }}
      allowDismiss={!portalLoading}
      title="Before you cancel"
      tone="default"
      description={<p className="m-0 text-sm leading-relaxed text-slate-600">{description}</p>}
      children={null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="secondary" size="sm" disabled={portalLoading} onClick={onClose}>
            Close
          </Button>
          {showDowngrade ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={portalLoading}
              onClick={() => {
                onClose();
                onDowngradeToStarter();
              }}
            >
              Downgrade to Starter
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={portalLoading}
            onClick={() => void onContinueToPortal()}
          >
            {portalLoading ? 'Opening…' : 'Continue to Lemon Squeezy'}
          </Button>
        </div>
      }
    />
  );
}
