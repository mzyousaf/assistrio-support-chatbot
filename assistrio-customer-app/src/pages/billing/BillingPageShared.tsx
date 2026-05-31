import { AlertTriangle } from 'lucide-react';
import { Button, Card, CardBody } from '@/components/ui';

export { BillingPageSkeleton } from '@/pages/billing/BillingPageSkeleton';

export function BillingEmptyWorkspaceCard() {
  return (
    <Card className="border-slate-200/90 shadow-[var(--shadow-card)]">
      <CardBody>
        <p className="m-0 text-sm leading-relaxed text-slate-600">No active workspace selected.</p>
      </CardBody>
    </Card>
  );
}

export function BillingErrorCard(props: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-amber-200/90 bg-amber-50/70 shadow-[var(--shadow-card)]">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden />
          <div className="min-w-0">
            <p className="m-0 font-semibold text-amber-950">Could not load billing details</p>
            <p className="m-0 mt-1 text-sm leading-relaxed text-amber-900/90">{props.message}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={props.onRetry}>
          Retry
        </Button>
      </CardBody>
    </Card>
  );
}

export function BillingPaymentSetupNotice() {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="m-0 text-base font-semibold text-slate-900">Payment setup</h2>
      <p className="m-0 mt-2 text-sm leading-relaxed text-slate-600">
        Checkout and payment methods are not enabled yet. Billing is read-only for now—you can review
        your plan, limits, and usage here while we finish payment setup.
      </p>
    </div>
  );
}
