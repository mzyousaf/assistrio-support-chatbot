import type { FormHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEP_FORM_ID } from '@/onboarding/OnboardingStepActionsContext';
import type { OnboardingStepPath } from '@/onboarding/onboardingState';
import { ONBOARDING_STEP_DISPLAY } from './onboardingStepper.constants';
import { ONBOARDING_STEP_HEADER_ICONS } from './onboardingStepHeaderIcons';
import { OnboardingStepHeader } from './OnboardingStepHeader';

export type OnboardingStepPanelProps = {
  stepId: OnboardingStepPath;
  title?: string;
  description?: string;
  eyebrow?: string;
  headerIcon?: LucideIcon;
  requirementLabel?: string;
  helperLine?: string;
  headerClassName?: string;
  children: ReactNode;
  className?: string;
  formProps?: FormHTMLAttributes<HTMLFormElement>;
};

/** Main content column for an onboarding step — header + scrollable form surface. */
export function OnboardingStepPanel({
  stepId,
  title,
  description,
  eyebrow,
  headerIcon,
  requirementLabel,
  helperLine,
  headerClassName,
  children,
  className,
  formProps,
}: OnboardingStepPanelProps) {
  const meta = ONBOARDING_STEP_DISPLAY.find((s) => s.id === stepId);
  const icon = headerIcon ?? ONBOARDING_STEP_HEADER_ICONS[stepId];

  const bodyClass = cn(
    'onboarding-step-body onboarding-form-surface flex flex-col',
  );

  const inner = formProps ? (
    (() => {
      const { className: formClassName, ...rest } = formProps;
      return (
        <form
          {...rest}
          id={rest.id ?? ONBOARDING_STEP_FORM_ID}
          className={cn(bodyClass, 'onboarding-step-form', formClassName)}
        >
          {children}
        </form>
      );
    })()
  ) : (
    <div className={cn(bodyClass, 'onboarding-step-form')}>{children}</div>
  );

  return (
    <div className={cn('onboarding-content-stack', className)}>
      <OnboardingStepHeader
        className={headerClassName}
        title={title ?? meta?.title ?? stepId}
        description={description ?? meta?.description}
        eyebrow={eyebrow}
        icon={icon}
        requirementLabel={requirementLabel}
        helperLine={helperLine}
      />
      {inner}
    </div>
  );
}
