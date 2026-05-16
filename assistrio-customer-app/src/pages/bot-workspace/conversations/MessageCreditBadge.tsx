import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

function isBillableBlockedReason(reason: string): boolean {
  return reason.trim().toLowerCase().endsWith('_not_billable');
}

/** Footer shows persisted billing when we have creditCost from the API or a creditReason fingerprint. */
export function shouldShowMessageCreditBadge(creditCost?: number, creditReason?: string): boolean {
  if (typeof creditCost === 'number' && Number.isFinite(creditCost)) return true;
  return Boolean(String(creditReason ?? '').trim());
}

function formatSpendLabel(cost: number, creditReason?: string): string {
  const rr = String(creditReason ?? '').trim();
  if (!Number.isFinite(cost)) return 'Unknown billing';
  if (cost !== 0) {
    const n = cost % 1 === 0 ? String(Math.round(cost)) : String(cost);
    return cost === 1 ? `${n} AI Credit` : `${n} AI Credits`;
  }
  if (rr && isBillableBlockedReason(rr)) return 'Not billable';
  return `${cost % 1 === 0 ? String(Math.round(cost)) : String(cost)} AI Credits`;
}

type Props = {
  creditCost?: number;
  creditReason?: string;
  className?: string;
};

export function MessageCreditBadge({ creditCost, creditReason, className }: Props) {
  const reasonStr = String(creditReason ?? '').trim();
  const costKnown = typeof creditCost === 'number' && Number.isFinite(creditCost);
  if (!costKnown && !reasonStr) return null;

  const finiteCost = costKnown ? creditCost! : 0;
  const label = costKnown ? formatSpendLabel(finiteCost, reasonStr) : 'Unknown billing';
  const muted = label === 'Not billable' || label === 'Unknown billing';

  return (
    <span
      title={reasonStr || undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight shadow-sm',
        muted
          ? 'border-slate-300/95 bg-slate-50 text-slate-700'
          : 'border-[var(--color-teal-600)] bg-[var(--teal-50)] text-[var(--color-teal-800)]',
        className,
      )}
    >
      <Sparkles className={cn('size-3 shrink-0', muted ? 'text-slate-500' : 'text-[var(--color-teal-600)]')} strokeWidth={2} aria-hidden />
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
