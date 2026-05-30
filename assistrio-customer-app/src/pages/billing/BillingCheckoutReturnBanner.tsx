import { CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { WorkspaceBillingSummary } from '@/api/types';
import {
  billingCheckoutChangesApplied,
  captureBillingCheckoutSnapshot,
  type BillingCheckoutSnapshot,
} from '@/lib/billingCheckoutReturn';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export type CheckoutReturnPhase = 'idle' | 'confirming' | 'updated';

type Props = {
  summary: WorkspaceBillingSummary | null;
  onRefreshBilling: () => void | Promise<void>;
  refreshing?: boolean;
  className?: string;
};

export function BillingCheckoutReturnBanner({
  summary,
  onRefreshBilling,
  refreshing = false,
  className,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkout = searchParams.get('checkout');
  const baselineRef = useRef<BillingCheckoutSnapshot | null>(null);
  const [phase, setPhase] = useState<CheckoutReturnPhase>('idle');

  useEffect(() => {
    if (checkout !== 'success') {
      baselineRef.current = null;
      setPhase('idle');
      return;
    }
    if (!summary) return;

    if (!baselineRef.current) {
      baselineRef.current = captureBillingCheckoutSnapshot(summary);
      setPhase('confirming');
      return;
    }

    if (billingCheckoutChangesApplied(baselineRef.current, summary)) {
      setPhase('updated');
    }
  }, [checkout, summary]);

  const handleRefresh = useCallback(async () => {
    await onRefreshBilling();
  }, [onRefreshBilling]);

  if (checkout !== 'success' && checkout !== 'cancelled') {
    return null;
  }

  const isSuccess = checkout === 'success';
  const isUpdated = isSuccess && phase === 'updated';

  const message = isSuccess
    ? isUpdated
      ? 'Billing updated successfully.'
      : "Checkout completed. We're confirming your payment."
    : 'Checkout was cancelled.';

  const dismiss = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
    baselineRef.current = null;
    setPhase('idle');
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed sm:flex-row sm:items-start',
        isSuccess
          ? isUpdated
            ? 'border-teal-200/90 bg-teal-50/90 text-teal-950'
            : 'border-amber-200/90 bg-amber-50/90 text-amber-950'
          : 'border-slate-200/90 bg-slate-50/90 text-slate-700',
        className,
      )}
      role="status"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {isSuccess ? (
          <CheckCircle2
            size={18}
            className={cn('mt-0.5 shrink-0', isUpdated ? 'text-teal-700' : 'text-amber-700')}
            aria-hidden
          />
        ) : (
          <Info size={18} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
        )}
        <p className="m-0 min-w-0 flex-1">{message}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {isSuccess && !isUpdated ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
          >
            <RefreshCw size={14} className={cn('mr-1.5', refreshing && 'animate-spin')} aria-hidden />
            Refresh billing status
          </Button>
        ) : null}
        <button
          type="button"
          className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
          onClick={dismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
