import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onBuyCredits: () => void | Promise<void>;
  busy?: boolean;
  checkoutAvailable?: boolean;
};

export function AiCreditsTopUpPromptModal({
  open,
  onClose,
  onBuyCredits,
  busy = false,
  checkoutAvailable = true,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      allowDismiss={!busy}
      title="Buy extra AI credits"
      tone="default"
      description={
        <div className="space-y-2 text-sm leading-relaxed text-slate-600">
          <p className="m-0">
            Your workspace has used all monthly and top-up AI credits. Buy a one-time pack to keep
            chatting.
          </p>
          <p className="m-0 text-xs text-slate-500">
            This does not charge your card automatically. You&apos;ll confirm the purchase in Lemon
            Squeezy.
          </p>
        </div>
      }
      children={null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            Not now
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || !checkoutAvailable}
            onClick={() => void onBuyCredits()}
          >
            {busy ? 'Opening checkout…' : 'Buy 1,000 credits — $30'}
          </Button>
        </div>
      }
    />
  );
}
