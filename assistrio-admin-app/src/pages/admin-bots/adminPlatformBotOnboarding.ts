export const ADMIN_PLATFORM_BOT_ONBOARDING_STEPS = [
  { id: 'platform', label: 'Platform bot' },
  { id: 'profile', label: 'Profile' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'deploy', label: 'Deploy' },
] as const;

export type AdminPlatformBotOnboardingStepId =
  (typeof ADMIN_PLATFORM_BOT_ONBOARDING_STEPS)[number]['id'];

const SESSION_KEY = 'admin_platform_bot_onboarding_v1';

export type AdminPlatformBotOnboardingSession = {
  botId: string;
  stepsCompleted: AdminPlatformBotOnboardingStepId[];
};

export function readAdminPlatformBotOnboardingSession(): AdminPlatformBotOnboardingSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminPlatformBotOnboardingSession;
    if (!parsed?.botId || !Array.isArray(parsed.stepsCompleted)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAdminPlatformBotOnboardingSession(session: AdminPlatformBotOnboardingSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAdminPlatformBotOnboardingSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function stepIndex(stepId: AdminPlatformBotOnboardingStepId): number {
  return ADMIN_PLATFORM_BOT_ONBOARDING_STEPS.findIndex((s) => s.id === stepId);
}

export function maxReachableStepIndex(stepsCompleted: AdminPlatformBotOnboardingStepId[]): number {
  let max = 0;
  for (let i = 1; i < ADMIN_PLATFORM_BOT_ONBOARDING_STEPS.length; i++) {
    const prev = ADMIN_PLATFORM_BOT_ONBOARDING_STEPS[i - 1].id;
    if (stepsCompleted.includes(prev)) max = i;
  }
  return max;
}

export const onboardingStyles = {
  step: 'flex flex-col gap-3',
  h2: 'm-0 text-[1.125rem] font-semibold text-slate-900',
  p: 'm-0 text-[0.9375rem] leading-[1.5] text-slate-400',
  label: 'flex flex-col gap-[0.35rem] text-[0.875rem] text-slate-600',
  errBanner:
    'm-0 rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-[0.65rem] text-[0.875rem] text-[var(--color-danger-text-emphasis)]',
  actions: 'mt-2 flex flex-wrap items-center justify-between gap-4',
  back: 'text-[0.875rem] font-semibold text-primary no-underline hover:text-[var(--teal-800)]',
  code: 'rounded-md bg-slate-100 px-1 py-0.5 font-mono text-[0.8125em] text-slate-600',
} as const;
