import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import type { OnboardingStepPrimaryAction } from '@/onboarding/OnboardingStepActionsContext';

export type OnboardingStepPrimaryButtonProps = OnboardingStepPrimaryAction & {
  className?: string;
};

/** Primary Continue / Go live button — lives inside the current stepper step. */
export function OnboardingStepPrimaryButton({
  primaryLabel,
  primaryType = 'submit',
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  form,
  className,
}: OnboardingStepPrimaryButtonProps) {
  const disabled = primaryDisabled || primaryLoading;

  return (
    <Button
      type={primaryType}
      variant="primary"
      size="sm"
      className={cn('mt-2.5 h-7 w-auto self-start shrink-0 px-3 text-[0.75rem] font-semibold', className)}
      form={form}
      disabled={disabled}
      aria-busy={primaryLoading || undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (primaryType === 'button') onPrimary?.();
      }}
    >
      {primaryLoading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {primaryLabel}
    </Button>
  );
}
