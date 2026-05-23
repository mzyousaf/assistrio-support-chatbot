import { describe, expect, it } from 'vitest';
import {
  emptyOnboardingResponse,
  resolveOnboardingResumeStep,
} from './resolveOnboardingResumeStep';

describe('resolveOnboardingResumeStep', () => {
  it('returns agent-profile when no steps are completed', () => {
    expect(resolveOnboardingResumeStep(emptyOnboardingResponse())).toEqual({
      type: 'step',
      step: 'agent-profile',
    });
  });

  it('returns describe-profile when profile is done', () => {
    const onboarding = emptyOnboardingResponse({
      onboardingCurrentStep: 'agent-profile',
      draft: {
        ...emptyOnboardingResponse().draft,
        profile: { ...emptyOnboardingResponse().draft.profile, name: 'Ada' },
        stepsCompleted: ['agent-profile'],
      },
    });
    expect(resolveOnboardingResumeStep(onboarding)).toEqual({
      type: 'step',
      step: 'describe-profile',
    });
  });

  it('returns knowledge-base when profile and describe are done', () => {
    const onboarding = emptyOnboardingResponse({
      onboardingCurrentStep: 'describe-profile',
      draft: {
        ...emptyOnboardingResponse().draft,
        profile: { ...emptyOnboardingResponse().draft.profile, name: 'Ada' },
        instructions: {
          ...emptyOnboardingResponse().draft.instructions,
          systemPrompt: 'Be helpful.',
        },
        stepsCompleted: ['agent-profile', 'describe-profile'],
      },
    });
    expect(resolveOnboardingResumeStep(onboarding)).toEqual({
      type: 'step',
      step: 'knowledge-base',
    });
  });

  it('returns go-live when profile, describe, and knowledge are done', () => {
    const onboarding = emptyOnboardingResponse({
      onboardingCurrentStep: 'knowledge-base',
      draft: {
        ...emptyOnboardingResponse().draft,
        profile: { ...emptyOnboardingResponse().draft.profile, name: 'Ada' },
        instructions: {
          ...emptyOnboardingResponse().draft.instructions,
          systemPrompt: 'Be helpful.',
        },
        knowledge: {
          ...emptyOnboardingResponse().draft.knowledge,
          snippets: [{ id: 's1', title: 'About', description: 'We help customers.' }],
        },
        stepsCompleted: ['agent-profile', 'describe-profile', 'knowledge-base'],
      },
    });
    expect(resolveOnboardingResumeStep(onboarding)).toEqual({
      type: 'step',
      step: 'go-live',
    });
  });

  it('returns /bots when onboarding is completed', () => {
    expect(
      resolveOnboardingResumeStep(
        emptyOnboardingResponse({
          onboardingStatus: 'completed',
          onboardingCurrentStep: 'you-are-live',
        }),
      ),
    ).toEqual({ type: 'route', path: '/bots' });
  });

  it('uses first incomplete when backend current step is invalid', () => {
    const onboarding = emptyOnboardingResponse({
      onboardingCurrentStep: 'you-are-live',
      draft: {
        ...emptyOnboardingResponse().draft,
        profile: { ...emptyOnboardingResponse().draft.profile, name: 'Ada' },
        stepsCompleted: ['agent-profile'],
      },
    });
    expect(resolveOnboardingResumeStep(onboarding)).toEqual({
      type: 'step',
      step: 'describe-profile',
    });
  });

  it('uses first incomplete when backend current step is behind completed progress', () => {
    const onboarding = emptyOnboardingResponse({
      onboardingCurrentStep: 'agent-profile',
      draft: {
        ...emptyOnboardingResponse().draft,
        profile: { ...emptyOnboardingResponse().draft.profile, name: 'Ada' },
        stepsCompleted: ['agent-profile'],
      },
    });
    expect(resolveOnboardingResumeStep(onboarding)).toEqual({
      type: 'step',
      step: 'describe-profile',
    });
  });

  it('routes to go-live for recoverable transfer errors', () => {
    const onboarding = emptyOnboardingResponse({
      onboardingCurrentStep: 'knowledge-base',
      draft: {
        ...emptyOnboardingResponse().draft,
        profile: { ...emptyOnboardingResponse().draft.profile, name: 'Ada' },
        instructions: {
          ...emptyOnboardingResponse().draft.instructions,
          systemPrompt: 'Be helpful.',
        },
        knowledge: {
          ...emptyOnboardingResponse().draft.knowledge,
          snippets: [{ id: 's1', title: 'About', description: 'We help customers.' }],
        },
        stepsCompleted: ['agent-profile', 'describe-profile', 'knowledge-base'],
      },
      stagedKnowledge: {
        documents: [
          {
            id: 'doc-1',
            sourceType: 'document',
            originalName: 'guide.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 100,
            status: 'transfer_pending',
            createdAt: null,
          },
        ],
        datasheets: [],
      },
    });
    expect(resolveOnboardingResumeStep(onboarding)).toEqual({
      type: 'step',
      step: 'go-live',
    });
  });

  it('prefers valid reachable backend current step when ahead of first incomplete', () => {
    const onboarding = emptyOnboardingResponse({
      onboardingCurrentStep: 'knowledge-base',
      draft: {
        ...emptyOnboardingResponse().draft,
        profile: { ...emptyOnboardingResponse().draft.profile, name: 'Ada' },
        instructions: {
          ...emptyOnboardingResponse().draft.instructions,
          systemPrompt: 'Be helpful.',
        },
        stepsCompleted: ['agent-profile', 'describe-profile'],
      },
    });
    expect(resolveOnboardingResumeStep(onboarding)).toEqual({
      type: 'step',
      step: 'knowledge-base',
    });
  });

  it('routes live_pending_install to go-live', () => {
    expect(
      resolveOnboardingResumeStep(
        emptyOnboardingResponse({
          onboardingStatus: 'live_pending_install',
          onboardingCurrentStep: 'you-are-live',
          onboardingCreatedBotId: 'bot-1',
        }),
      ),
    ).toEqual({ type: 'step', step: 'go-live' });
  });
});
