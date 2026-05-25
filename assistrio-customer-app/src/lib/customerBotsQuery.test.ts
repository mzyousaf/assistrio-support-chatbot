import { describe, expect, it } from 'vitest';
import {
  buildCustomerBotsListQuery,
  shouldFetchBotsForOnboardingHeuristic,
} from './customerBotsQuery';

describe('buildCustomerBotsListQuery', () => {
  it('returns workspaceId for active workspace', () => {
    expect(buildCustomerBotsListQuery({ activeWorkspaceId: 'ws-1' })).toEqual({ workspaceId: 'ws-1' });
  });

  it('includes status when not all', () => {
    expect(buildCustomerBotsListQuery({ activeWorkspaceId: 'ws-1', status: 'published' })).toEqual({
      workspaceId: 'ws-1',
      status: 'published',
    });
  });

  it('returns null when active workspace missing', () => {
    expect(buildCustomerBotsListQuery({ activeWorkspaceId: null })).toBeNull();
  });
});

describe('shouldFetchBotsForOnboardingHeuristic', () => {
  it('returns false for members', () => {
    expect(
      shouldFetchBotsForOnboardingHeuristic({ role: 'member', onboardingStatus: null }),
    ).toBe(false);
  });

  it('returns false when onboarding status is set', () => {
    expect(
      shouldFetchBotsForOnboardingHeuristic({ role: 'admin', onboardingStatus: 'not_started' }),
    ).toBe(false);
  });

  it('returns true for admin with missing onboarding status (legacy fallback)', () => {
    expect(
      shouldFetchBotsForOnboardingHeuristic({ role: 'admin', onboardingStatus: null }),
    ).toBe(true);
  });

  it('returns true for owner with missing onboarding status (legacy fallback)', () => {
    expect(
      shouldFetchBotsForOnboardingHeuristic({ role: 'owner', onboardingStatus: null }),
    ).toBe(true);
  });
});
