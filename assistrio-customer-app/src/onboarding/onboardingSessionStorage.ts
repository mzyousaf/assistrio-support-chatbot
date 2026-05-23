const SETUP_FINISHED_KEY = 'assistrio_customer.setup_finished_v1';
const ONBOARDING_SESSION_KEY = 'assistrio_customer.onboarding_session_v1';

/** @deprecated Legacy local onboarding session — cleared on sign-out only. */
export type OnboardingSessionV2 = {
  v: 2;
  workspaceId: string;
  stepsCompleted: string[];
};

/** @deprecated Bot-first onboarding session — ignored. */
export type OnboardingSessionV1 = {
  v: 1;
  botId: string;
  clientDraftId: string;
  stepsCompleted: string[];
};

/** @deprecated Legacy type alias. */
export type OnboardingSession = OnboardingSessionV2;

/** Legacy fallback when workspace has no onboardingStatus (pre-migration accounts). */
export function readSetupFinished(): boolean {
  try {
    return localStorage.getItem(SETUP_FINISHED_KEY) === '1';
  } catch {
    return false;
  }
}

/** @deprecated Do not write during active onboarding — backend completion is source of truth. */
export function markCustomerSetupFinished(): void {
  try {
    localStorage.setItem(SETUP_FINISHED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearCustomerSetupFinished(): void {
  try {
    localStorage.removeItem(SETUP_FINISHED_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Onboarding progress is loaded from the backend. */
export function readOnboardingSession(): OnboardingSessionV2 | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as OnboardingSessionV2 | OnboardingSessionV1;
    if (o?.v === 2 && typeof o.workspaceId === 'string' && o.workspaceId.trim()) {
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/** @deprecated No-op — onboarding session is not stored locally. */
export function writeOnboardingSession(_session: OnboardingSessionV2): void {
  /* backend-owned */
}

/** Remove legacy onboarding keys (e.g. on sign-out). */
export function clearOnboardingSession(): void {
  try {
    localStorage.removeItem(ONBOARDING_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAllOnboardingLocalStorage(): void {
  clearOnboardingSession();
  clearCustomerSetupFinished();
}
