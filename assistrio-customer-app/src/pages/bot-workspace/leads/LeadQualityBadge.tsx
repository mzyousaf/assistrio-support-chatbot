import { cn } from '@/lib/utils';
import type { LeadQualityKind } from './leadsUiHelpers';

const styles: Record<LeadQualityKind, string> = {
  complete: 'border-emerald-200/90 bg-emerald-50/95 text-emerald-900',
  partial: 'border-amber-200/90 bg-amber-50/90 text-amber-900',
  missing_email: 'border-teal-200/80 bg-teal-50/70 text-teal-900',
  missing_phone: 'border-teal-200/80 bg-teal-50/70 text-teal-900',
};

type Props = {
  kind: LeadQualityKind;
  label: string;
  className?: string;
};

export function LeadQualityBadge({ kind, label, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
        styles[kind],
        className,
      )}
    >
      {label}
    </span>
  );
}
