import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { ONBOARDING_STEP_FORM_ID } from '@/onboarding/OnboardingStepActionsContext';

export type OnboardingActionBarProps = {
  backHref?: string;
  backDisabled?: boolean;
  primaryLabel: string;
  primaryType?: 'submit' | 'button';
  onPrimary?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  form?: string;
  className?: string;
};

/** Sticky Back / primary CTA bar at the bottom of an onboarding step form. */
export function OnboardingActionBar({
  backHref,
  backDisabled = false,
  primaryLabel,
  primaryType = 'submit',
  onPrimary,
  primaryLoading = false,
  primaryDisabled = false,
  form,
  className,
}: OnboardingActionBarProps) {
  const disabled = primaryDisabled || primaryLoading;

  const backButtonClass = cn(
    'inline-flex h-10 items-center justify-center gap-2 rounded-[var(--ui-radius)] border border-[var(--ui-border)]',
    'bg-[var(--ui-surface)] px-4 text-sm font-medium text-slate-800 no-underline shadow-none transition-colors',
    'hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900/12',
    primaryLoading && 'pointer-events-none opacity-50',
  );

  return (
    <div className={cn('onboarding-action-bar', className)}>
      <div className="onboarding-action-bar-inner">
        {backHref && !backDisabled ? (
          <Link to={backHref} className={backButtonClass}>
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Back
          </Link>
        ) : (
          <span aria-hidden className="hidden sm:block" />
        )}

        <Button
          type={primaryType}
          variant="primary"
          size="lg"
          className="min-w-[9.5rem] shrink-0"
          form={form ?? (primaryType === 'submit' ? ONBOARDING_STEP_FORM_ID : undefined)}
          disabled={disabled}
          aria-busy={primaryLoading || undefined}
          onClick={(e) => {
            if (primaryType === 'button') {
              e.preventDefault();
              onPrimary?.();
            }
          }}
        >
          {primaryLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
