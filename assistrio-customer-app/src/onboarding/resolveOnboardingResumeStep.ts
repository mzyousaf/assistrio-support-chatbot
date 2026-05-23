import type { WorkspaceOnboardingResponse } from '../api/types';
import { mergeStepsCompletedFromDraft } from './onboardingProgress';
import {
  maxReachableStepIndex,
  ONBOARDING_STEPS,
  stepIndex,
  type OnboardingStepPath,
} from './onboardingState';

export type OnboardingResumeDestination =
  | { type: 'route'; path: '/bots' }
  | { type: 'step'; step: OnboardingStepPath };

const FLOW_STEPS = ONBOARDING_STEPS.map((s) => s.path);

const EMPTY_DRAFT: WorkspaceOnboardingResponse['draft'] = {
  profile: {
    name: '',
    shortDescription: '',
    description: '',
    brandColor: '',
    categories: [],
    avatarSource: 'none',
    imageUrl: '',
    avatarEmoji: '',
    avatarStorageKey: '',
  },
  instructions: {
    description: '',
    systemPrompt: '',
    tone: '',
    behaviorPreset: '',
    responseLength: '',
    maxTokens: 0,
  },
  knowledge: {
    snippets: [],
    qas: [],
    knowledgeDescription: '',
    faqs: [],
  },
  goLive: { allowedOrigins: [] },
  stepsCompleted: [],
  createdAt: null,
  updatedAt: null,
};

function isFlowStep(step: string): step is OnboardingStepPath {
  return FLOW_STEPS.includes(step as OnboardingStepPath);
}

function firstIncompleteStep(stepsCompleted: string[]): OnboardingStepPath {
  for (const step of FLOW_STEPS) {
    if (!stepsCompleted.includes(step)) return step;
  }
  return 'go-live';
}

function hasRecoverableGoLiveError(onboarding: WorkspaceOnboardingResponse): boolean {
  const items = [
    ...(onboarding.stagedKnowledge?.documents ?? []),
    ...(onboarding.stagedKnowledge?.datasheets ?? []),
  ];
  return items.some((item) => item.status === 'failed' || item.status === 'transfer_pending');
}

function resolvePreferredStep(
  backendCurrentStep: string | undefined,
  stepsCompleted: string[],
  firstIncomplete: OnboardingStepPath,
): OnboardingStepPath {
  if (!backendCurrentStep || !isFlowStep(backendCurrentStep)) {
    return firstIncomplete;
  }

  const backendIndex = stepIndex(backendCurrentStep);
  const maxReachable = maxReachableStepIndex(stepsCompleted);
  if (backendIndex > maxReachable) {
    return firstIncomplete;
  }

  const incompleteIndex = stepIndex(firstIncomplete);
  if (stepsCompleted.includes(backendCurrentStep) && incompleteIndex > backendIndex) {
    return firstIncomplete;
  }

  if (backendIndex >= incompleteIndex) {
    return backendCurrentStep;
  }

  return firstIncomplete;
}

/** Resolve where onboarding should resume from backend-owned state. */
export function resolveOnboardingResumeStep(
  onboarding: WorkspaceOnboardingResponse | null | undefined,
): OnboardingResumeDestination {
  if (!onboarding) {
    return { type: 'step', step: 'agent-profile' };
  }

  if (onboarding.onboardingStatus === 'completed') {
    return { type: 'route', path: '/bots' };
  }

  if (onboarding.onboardingStatus === 'live_pending_install') {
    return { type: 'step', step: 'go-live' };
  }

  const stepsCompleted = mergeStepsCompletedFromDraft(onboarding);

  if (hasRecoverableGoLiveError(onboarding)) {
    return { type: 'step', step: 'go-live' };
  }

  const firstIncomplete = firstIncompleteStep(stepsCompleted);
  const step = resolvePreferredStep(onboarding.onboardingCurrentStep, stepsCompleted, firstIncomplete);

  return { type: 'step', step };
}

export function onboardingResumePath(
  onboarding: WorkspaceOnboardingResponse | null | undefined,
): string {
  const dest = resolveOnboardingResumeStep(onboarding);
  if (dest.type === 'route') return dest.path;
  return `/onboarding/${dest.step}`;
}

/** Minimal onboarding payload for tests and fallbacks. */
export function emptyOnboardingResponse(
  overrides?: Partial<WorkspaceOnboardingResponse>,
): WorkspaceOnboardingResponse {
  return {
    workspaceId: 'ws-test',
    onboardingStatus: 'in_progress',
    onboardingCurrentStep: 'agent-profile',
    onboardingDraftId: null,
    onboardingCreatedBotId: null,
    onboardingCompletedAt: null,
    draft: { ...EMPTY_DRAFT, ...(overrides?.draft ?? {}) },
    ...overrides,
  };
}
