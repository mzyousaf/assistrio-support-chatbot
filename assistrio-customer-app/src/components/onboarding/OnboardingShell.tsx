import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type OnboardingShellProps = {
  sidebar: ReactNode;
  mobileStepper?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Full-height wizard shell: teal sidebar column + neutral content column.
 */
export function OnboardingShell({ sidebar, mobileStepper, children, className }: OnboardingShellProps) {
  return (
    <div className={cn('onboarding-shell flex min-h-0 w-full flex-1 flex-col', className)}>
      {mobileStepper ? (
        <div className="shrink-0 border-b border-[var(--color-primary-border)]/60 bg-[var(--color-primary-soft)]/80 px-[var(--layout-main-pad-x)] py-3 md:hidden">
          {mobileStepper}
        </div>
      ) : null}

      <aside
        className={cn(
          'onboarding-sidebar hidden min-h-0 md:flex md:flex-col md:overflow-y-auto',
        )}
      >
        <div className="onboarding-sidebar-inner px-4 py-4 sm:px-5 sm:py-5">
          <header className="onboarding-sidebar-header mb-5 border-b border-[color-mix(in_oklab,var(--color-teal-200)_45%,transparent)] pb-4">
            <span className="onboarding-sidebar-eyebrow inline-flex items-center rounded-full border border-[var(--color-primary-border)]/70 bg-white/80 px-2 py-0.5 text-[var(--color-teal-700)] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              Agent Setup
            </span>
            <h1 className="onboarding-sidebar-heading m-0 mt-2.5 text-[var(--color-text-primary)]">
              Set up your first AI Agent
            </h1>
            <p className="onboarding-sidebar-lead m-0 mt-1 text-[var(--color-text-secondary)]">
              From setup to go live, then use your agent on your website.
            </p>
          </header>
          {sidebar}
        </div>
      </aside>

      <div className="onboarding-content flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="onboarding-main-content">{children}</main>
      </div>
    </div>
  );
}
