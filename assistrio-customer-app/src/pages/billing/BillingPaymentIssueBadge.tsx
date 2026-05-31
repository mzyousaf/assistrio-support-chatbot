import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function BillingPaymentIssueBadge({ className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900',
        className,
      )}
    >
      Payment issue
    </span>
  );
}
