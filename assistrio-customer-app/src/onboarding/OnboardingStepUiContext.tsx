import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { OnboardingStepPath } from './onboardingState';

type OnboardingStepUiContextValue = {
  attemptedStepIds: ReadonlySet<OnboardingStepPath>;
  savingStepId: OnboardingStepPath | null;
  markStepAttemptFailed: (stepId: OnboardingStepPath) => void;
  clearStepAttempt: (stepId: OnboardingStepPath) => void;
  setSavingStepId: (stepId: OnboardingStepPath | null) => void;
};

const OnboardingStepUiContext = createContext<OnboardingStepUiContextValue | null>(null);

export function OnboardingStepUiProvider({ children }: { children: ReactNode }) {
  const [attempted, setAttempted] = useState<Set<OnboardingStepPath>>(() => new Set());
  const [savingStepId, setSavingStepId] = useState<OnboardingStepPath | null>(null);

  const markStepAttemptFailed = useCallback((stepId: OnboardingStepPath) => {
    setAttempted((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);

  const clearStepAttempt = useCallback((stepId: OnboardingStepPath) => {
    setAttempted((prev) => {
      if (!prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      attemptedStepIds: attempted,
      savingStepId,
      markStepAttemptFailed,
      clearStepAttempt,
      setSavingStepId,
    }),
    [attempted, savingStepId, markStepAttemptFailed, clearStepAttempt],
  );

  return (
    <OnboardingStepUiContext.Provider value={value}>{children}</OnboardingStepUiContext.Provider>
  );
}

export function useOnboardingStepUi(): OnboardingStepUiContextValue {
  const ctx = useContext(OnboardingStepUiContext);
  if (!ctx) {
    throw new Error('useOnboardingStepUi must be used within OnboardingStepUiProvider');
  }
  return ctx;
}
