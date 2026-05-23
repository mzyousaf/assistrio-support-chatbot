import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type OnboardingStepHeaderProps = {
  title: string;
  description?: string;
  /** Small label above the title (e.g. “Behavior setup”). */
  eyebrow?: string;
  icon?: LucideIcon;
  /** Optional requirement pill beside the title. */
  requirementLabel?: string;
  /** Muted helper line below the description (e.g. auto-save note). */
  helperLine?: string;
  className?: string;
};

/** Step title and helper copy in the main content column. */
export function OnboardingStepHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  requirementLabel,
  helperLine,
  className,
}: OnboardingStepHeaderProps) {
  return (
    <header className={cn('onboarding-page-header', className)}>
      {Icon && eyebrow ? (
        <div className="onboarding-page-header-eyebrow-row">
          <span className="onboarding-page-header-icon onboarding-page-header-icon--eyebrow" aria-hidden>
            <Icon className="size-[1.125rem]" strokeWidth={2} />
          </span>
          <p className="onboarding-page-header-eyebrow">{eyebrow}</p>
        </div>
      ) : eyebrow ? (
        <p className="onboarding-page-header-eyebrow">{eyebrow}</p>
      ) : null}

      <div className="onboarding-page-header-copy min-w-0">
        <div className="onboarding-page-header-title-row">
          {Icon && !eyebrow ? (
            <span className="onboarding-page-header-icon onboarding-page-header-icon--title" aria-hidden>
              <Icon className="size-[1.125rem]" strokeWidth={2} />
            </span>
          ) : null}
          <h2 className="onboarding-page-header-title">{title}</h2>
          {requirementLabel ? (
            <span className="onboarding-page-header-requirement">{requirementLabel}</span>
          ) : null}
        </div>
        {description ? <p className="onboarding-page-header-description">{description}</p> : null}
        {helperLine ? <p className="onboarding-page-header-helper">{helperLine}</p> : null}
      </div>
    </header>
  );
}
