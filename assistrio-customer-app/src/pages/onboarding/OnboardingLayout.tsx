import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { useOnboardingStepUi } from '../../onboarding/OnboardingStepUiContext';
import {
  OnboardingStepActionsProvider,
  useOnboardingStepActions,
} from '../../onboarding/OnboardingStepActionsContext';
import {
  maxReachableStepIndex,
  ONBOARDING_STEPS,
  stepIndex,
} from '../../onboarding/onboardingState';
import { PageLoader } from '../../components/PageLoader';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';
import { OnboardingTopNavbar } from '@/components/onboarding/OnboardingTopNavbar';
import { ONBOARDING_STEP_DISPLAY } from '@/components/onboarding/onboardingStepper.constants';
import { OnboardingStepTransition } from '@/components/onboarding/OnboardingStepTransition';
import { OnboardingLeaveStepProvider } from '../../onboarding/OnboardingLeaveStepModal';

function OnboardingPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--bg-app)]">
      <OnboardingTopNavbar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

function OnboardingLayoutInner() {
  const { phase, initError, stepsCompleted, onboarding } = useOnboardingFlow();
  const { attemptedStepIds, savingStepId } = useOnboardingStepUi();
  const { actions: stepActions } = useOnboardingStepActions();
  const { pathname } = useLocation();

  if (phase === 'loading') {
    return <PageLoader title="Preparing your assistant…" />;
  }

  if (phase === 'error') {
    return (
      <OnboardingPageFrame>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-[var(--color-danger-text-emphasis)]">
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
      </OnboardingPageFrame>
    );
  }

  const seg = pathname.replace(/.*\/onboarding\/?/, '').split('/').filter(Boolean)[0] ?? '';
  if (!seg) {
    return (
      <OnboardingPageFrame>
        <Outlet />
      </OnboardingPageFrame>
    );
  }
  const currentStep = ONBOARDING_STEPS.some((s) => s.path === seg) ? seg : ONBOARDING_STEPS[0].path;
  const maxI = maxReachableStepIndex(stepsCompleted);
  const curI = stepIndex(currentStep);
  if (curI > maxI) {
    return <Navigate to={`/onboarding/${ONBOARDING_STEPS[maxI].path}`} replace />;
  }

  const stepperProps = {
    steps: ONBOARDING_STEP_DISPLAY,
    currentStepId: currentStep,
    completedStepIds: stepsCompleted,
    maxReachableIndex: maxI,
    attemptedStepIds,
    savingStepId,
    onboarding,
    getStepHref: (stepId: string, index: number) =>
      index <= maxReachableStepIndex(stepsCompleted) ? `/onboarding/${stepId}` : undefined,
    stepActions,
  };

  return (
    <OnboardingPageFrame>
      <OnboardingShell
        className="min-h-0 flex-1"
        sidebar={<OnboardingStepper {...stepperProps} />}
        mobileStepper={<OnboardingStepper {...stepperProps} compact />}
      >
        <OnboardingStepTransition />
      </OnboardingShell>
    </OnboardingPageFrame>
  );
}

export function OnboardingLayout() {
  return (
    <OnboardingStepActionsProvider>
      <OnboardingLeaveStepProvider>
        <OnboardingLayoutInner />
      </OnboardingLeaveStepProvider>
    </OnboardingStepActionsProvider>
  );
}
