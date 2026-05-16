import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import {
  maxReachableStepIndex,
  ONBOARDING_STEPS,
  stepIndex,
} from '../../onboarding/onboardingState';
import { cn } from '@/lib/utils';
import { PageLoader } from '../../components/PageLoader';

export function OnboardingLayout() {
  const { phase, initError, stepsCompleted } = useOnboardingFlow();
  const { pathname } = useLocation();

  if (phase === 'loading') {
    return <PageLoader title="Preparing your assistant…" />;
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center text-[var(--color-danger-text-emphasis)]">
        <h1 className="m-0 text-xl font-semibold">Could not start onboarding</h1>
        <p className="m-0 text-[0.9375rem] text-slate-400">{initError}</p>
        <button
          type="button"
          className="mt-2 cursor-pointer rounded-lg border-none bg-primary px-4 py-2 text-[0.875rem] font-semibold text-white hover:bg-[var(--teal-800)]"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const seg = pathname.replace(/.*\/onboarding\/?/, '').split('/').filter(Boolean)[0] ?? '';
  const currentStep =
    seg && ONBOARDING_STEPS.some((s) => s.path === seg) ? seg : ONBOARDING_STEPS[0].path;
  const maxI = maxReachableStepIndex(stepsCompleted);
  const curI = stepIndex(currentStep);
  if (curI > maxI) {
    return <Navigate to={`/onboarding/${ONBOARDING_STEPS[maxI].path}`} replace />;
  }

  const progress = ((curI + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-8 px-[var(--layout-main-pad-x)] py-8">
      {/* Header */}
      <header>
        <h1 className="mb-1 mt-0 text-[1.375rem] font-semibold tracking-tight text-slate-900">
          Get started
        </h1>
        <p className="mb-4 mt-0 text-[0.9375rem] text-slate-400">
          Save each step before continuing. You can go back anytime.
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-[0.8125rem] text-slate-400">
          Step {curI + 1} of {ONBOARDING_STEPS.length}
        </p>
      </header>

      {/* Step tabs */}
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Onboarding steps">
        {ONBOARDING_STEPS.map((s, i) => {
          const reachable = i <= maxReachableStepIndex(stepsCompleted);
          const active = s.path === currentStep;
          const baseClass = 'flex items-center gap-2 rounded-lg px-3 py-2 text-[0.875rem] font-medium no-underline transition-colors duration-100';
          const activeClass = 'bg-[color-mix(in_srgb,var(--teal-600)_8%,transparent)] text-primary font-semibold';
          const reachableClass = 'text-slate-500 hover:bg-slate-50 hover:text-slate-900';
          const disabledClass = 'text-slate-300 cursor-default';

          if (reachable) {
            return (
              <li key={s.path}>
                <NavLink
                  to={`/onboarding/${s.path}`}
                  className={() => cn(baseClass, active ? activeClass : reachableClass)}
                >
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold', active ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600')}>
                    {i + 1}
                  </span>
                  {s.label}
                </NavLink>
              </li>
            );
          }
          return (
            <li key={s.path}>
              <span className={cn(baseClass, disabledClass)}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.6875rem] font-bold text-slate-300">
                  {i + 1}
                </span>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Step panel */}
      <section>
        <Outlet />
      </section>
    </div>
  );
}
