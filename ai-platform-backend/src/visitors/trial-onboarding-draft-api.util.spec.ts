import {
  parseTrialOnboardingDraftPatch,
  trialOnboardingDraftDocToApi,
  TRIAL_ONBOARDING_DEFAULT_BRAND_COLOR,
} from './trial-onboarding-draft-api.util';

describe('trialOnboardingDraftDocToApi', () => {
  it('returns v3 defaults for empty doc', () => {
    const api = trialOnboardingDraftDocToApi({}, new Date('2026-01-01T00:00:00.000Z'));
    expect(api.version).toBe(3);
    expect(api.profile.brandColor).toBe(TRIAL_ONBOARDING_DEFAULT_BRAND_COLOR);
    expect(api.profile.categories).toEqual(['support']);
    expect(api.setupStepOnceCompleted).toEqual([false, false, false, false]);
    expect(api.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('parseTrialOnboardingDraftPatch', () => {
  it('merges profile and step fields', () => {
    const patch = parseTrialOnboardingDraftPatch({
      profile: { agentName: 'Test', brandColor: '#ff0000' },
      setupExplicitMaxStepIndex: 2,
      currentStepId: 'knowledge-base',
    });
    expect(patch.set.agentName).toBe('Test');
    expect(patch.set.brandColor).toBe('#ff0000');
    expect(patch.set.setupExplicitMaxStepIndex).toBe(2);
    expect(patch.set.currentStepId).toBe('knowledge-base');
  });

  it('ignores invalid step ids', () => {
    const patch = parseTrialOnboardingDraftPatch({ currentStepId: 'nope' });
    expect(patch.set.currentStepId).toBeUndefined();
  });

  it('unsets avatarByUpload and clears legacy avatarUrl when profile.avatarByUpload is null', () => {
    const patch = parseTrialOnboardingDraftPatch({
      profile: { avatarByUpload: null },
    });
    expect(patch.unset?.avatarByUpload).toBe('');
    expect(patch.set.avatarUrl).toBe('');
  });
});
