import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export const ONBOARDING_STEP_FORM_ID = 'onboarding-step-form';

export type OnboardingStepPrimaryAction = {
  primaryLabel: string;
  primaryType?: 'submit' | 'button';
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  form?: string;
};

type OnboardingStepActionsContextValue = {
  actions: OnboardingStepPrimaryAction | null;
  setActions: (actions: OnboardingStepPrimaryAction | null) => void;
};

const OnboardingStepActionsContext = createContext<OnboardingStepActionsContextValue | null>(null);

export function OnboardingStepActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<OnboardingStepPrimaryAction | null>(null);

  const setActions = useCallback((next: OnboardingStepPrimaryAction | null) => {
    setActionsState(next);
  }, []);

  const value = useMemo(() => ({ actions, setActions }), [actions, setActions]);

  return (
    <OnboardingStepActionsContext.Provider value={value}>{children}</OnboardingStepActionsContext.Provider>
  );
}

export function useOnboardingStepActions(): OnboardingStepActionsContextValue {
  const ctx = useContext(OnboardingStepActionsContext);
  if (!ctx) {
    throw new Error('useOnboardingStepActions must be used within OnboardingStepActionsProvider');
  }
  return ctx;
}

/** Register primary CTA — rendered inside the current stepper step. */
export function useRegisterOnboardingStepActions(props: OnboardingStepPrimaryAction) {
  const { setActions } = useOnboardingStepActions();
  const propsRef = useRef(props);
  propsRef.current = props;

  const { primaryLabel, primaryType, primaryDisabled, primaryLoading, form } = props;

  useLayoutEffect(() => {
    setActions({
      primaryLabel,
      primaryType,
      onPrimary: () => propsRef.current.onPrimary?.(),
      primaryDisabled,
      primaryLoading,
      form:
        form ??
        (primaryType === 'submit' || primaryType === undefined ? ONBOARDING_STEP_FORM_ID : undefined),
    });
    return () => setActions(null);
  }, [setActions, primaryLabel, primaryType, primaryDisabled, primaryLoading, form]);
}
