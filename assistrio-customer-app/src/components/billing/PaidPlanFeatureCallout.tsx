import { Lock } from 'lucide-react';
import { Button } from '@/components/ui';
import { useUpgradePlanModal } from '@/components/billing/UpgradePlanModalProvider';
import type { UpgradePlanModalReason } from '@/lib/paidPlanFeatureCalloutCopy';
import { resolvePaidPlanFeatureCalloutPreset } from '@/lib/paidPlanFeatureCalloutCopy';
import { cn } from '@/lib/utils';

export type PaidPlanFeatureCalloutProps = {
  title: string;
  description: string;
  reason?: UpgradePlanModalReason;
  actionLabel?: string;
  compact?: boolean;
  className?: string;
  onAction?: () => void;
};

export function PaidPlanFeatureCallout({
  title,
  description,
  reason,
  actionLabel = 'View plans',
  compact = false,
  className,
  onAction,
}: PaidPlanFeatureCalloutProps) {
  const { openUpgradeModal } = useUpgradePlanModal();

  function handleAction() {
    if (onAction) {
      onAction();
      return;
    }
    if (reason) {
      openUpgradeModal({ reason });
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-50/80 via-amber-50/40 to-white shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
        compact ? 'p-3' : 'p-4 sm:p-5',
        className,
      )}
      role="note"
    >
      <div
        className={cn(
          'flex gap-3',
          compact ? 'flex-col sm:flex-row sm:items-center sm:justify-between' : 'flex-col sm:flex-row sm:items-start sm:justify-between',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 ring-1 ring-teal-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
              compact ? 'h-8 w-8' : 'h-10 w-10',
            )}
            aria-hidden
          >
            <Lock className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2} />
          </span>
          <div className="min-w-0 space-y-1">
            <p
              className={cn(
                'm-0 font-semibold text-slate-900',
                compact ? 'text-sm leading-snug' : 'text-base leading-snug',
              )}
            >
              {title}
            </p>
            <p
              className={cn(
                'm-0 leading-relaxed text-slate-600',
                compact ? 'text-xs sm:text-sm' : 'text-sm',
              )}
            >
              {description}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size={compact ? 'sm' : 'sm'}
          className={cn(
            'shrink-0 border-teal-200/80 bg-white text-teal-800 hover:bg-teal-50',
            compact ? 'w-full sm:w-auto' : 'w-full sm:w-auto sm:self-center',
          )}
          onClick={handleAction}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

type PresetProps = {
  reason: UpgradePlanModalReason;
  compact?: boolean;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function PaidPlanFeatureCalloutForReason({
  reason,
  compact,
  className,
  actionLabel,
  onAction,
}: PresetProps) {
  const preset = resolvePaidPlanFeatureCalloutPreset(reason);
  return (
    <PaidPlanFeatureCallout
      title={preset.title}
      description={preset.description}
      reason={preset.reason}
      compact={compact}
      className={className}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
