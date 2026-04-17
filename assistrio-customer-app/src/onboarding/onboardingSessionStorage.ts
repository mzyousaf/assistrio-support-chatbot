const SETUP_FINISHED_KEY = 'assistrio_customer.setup_finished_v1';
const ONBOARDING_SESSION_KEY = 'assistrio_customer.onboarding_session_v1';

export type OnboardingSessionV1 = {
  v: 1;
  botId: string;
  clientDraftId: string;
  stepsCompleted: string[];
};

function safeParse(raw: string | null): OnboardingSessionV1 | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as OnboardingSessionV1;
    if (o?.v !== 1 || typeof o.botId !== 'string' || typeof o.clientDraftId !== 'string') return null;
    const steps = Array.isArray(o.stepsCompleted) ? o.stepsCompleted.filter((x) => typeof x === 'string') : [];
    return { v: 1, botId: o.botId, clientDraftId: o.clientDraftId, stepsCompleted: steps };
  } catch {
    return null;
  }
}

export function readSetupFinished(): boolean {
  try {
    return localStorage.getItem(SETUP_FINISHED_KEY) === '1';
  } catch {
    return false;
  }
}

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

export function readOnboardingSession(): OnboardingSessionV1 | null {
  try {
    return safeParse(localStorage.getItem(ONBOARDING_SESSION_KEY));
  } catch {
    return null;
  }
}

export function writeOnboardingSession(session: OnboardingSessionV1): void {
  try {
    localStorage.setItem(ONBOARDING_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function updateOnboardingSession(patch: Partial<Pick<OnboardingSessionV1, 'stepsCompleted'>>): void {
  const cur = readOnboardingSession();
  if (!cur) return;
  writeOnboardingSession({
    ...cur,
    ...(patch.stepsCompleted != null ? { stepsCompleted: patch.stepsCompleted } : {}),
  });
}

export function clearOnboardingSession(): void {
  try {
    localStorage.removeItem(ONBOARDING_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
