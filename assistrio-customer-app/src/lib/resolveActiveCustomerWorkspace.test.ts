import { describe, expect, it } from 'vitest';
import type { CustomerMe } from '../api/types';
import {
  computeNeedsOnboardingForCustomer,
  resolveActiveCustomerWorkspace,
} from './resolveActiveCustomerWorkspace';

const baseCustomer: CustomerMe = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-invited',
  workspaceIds: ['ws-personal', 'ws-invited'],
  workspaces: [
    {
      id: 'ws-personal',
      name: 'Personal',
      role: 'admin',
      planKey: 'free',
      planName: 'Free',
      subscriptionStatus: 'free',
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 10,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      onboardingStatus: 'not_started',
    },
    {
      id: 'ws-invited',
      name: 'Team',
      role: 'member',
      planKey: 'free',
      planName: 'Free',
      subscriptionStatus: 'free',
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 10,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      onboardingStatus: 'completed',
    },
  ],
};

describe('resolveActiveCustomerWorkspace', () => {
  it('returns workspace matching activeWorkspaceId', () => {
    const resolved = resolveActiveCustomerWorkspace(baseCustomer);
    expect(resolved.activeWorkspaceId).toBe('ws-invited');
    expect(resolved.workspace?.name).toBe('Team');
    expect(resolved.role).toBe('member');
  });

  it('falls back to first workspace when activeWorkspaceId missing', () => {
    const resolved = resolveActiveCustomerWorkspace({
      ...baseCustomer,
      activeWorkspaceId: undefined,
    });
    expect(resolved.workspace?.id).toBe('ws-personal');
  });
});

describe('computeNeedsOnboardingForCustomer', () => {
  it('returns false for active workspace member role', () => {
    expect(computeNeedsOnboardingForCustomer(baseCustomer)).toBe(false);
  });

  it('returns true for active admin workspace with incomplete onboarding', () => {
    expect(
      computeNeedsOnboardingForCustomer({
        ...baseCustomer,
        activeWorkspaceId: 'ws-personal',
      }),
    ).toBe(true);
  });

  it('returns false for active admin workspace when onboarding completed', () => {
    expect(
      computeNeedsOnboardingForCustomer({
        ...baseCustomer,
        activeWorkspaceId: 'ws-personal',
        workspaces: [
          {
            ...baseCustomer.workspaces![0]!,
            onboardingStatus: 'completed',
          },
          baseCustomer.workspaces![1]!,
        ],
      }),
    ).toBe(false);
  });

  it('returns true for active owner workspace with incomplete onboarding', () => {
    expect(
      computeNeedsOnboardingForCustomer({
        ...baseCustomer,
        activeWorkspaceId: 'ws-personal',
        workspaces: [
          {
            ...baseCustomer.workspaces![0]!,
            role: 'owner',
          },
          baseCustomer.workspaces![1]!,
        ],
      }),
    ).toBe(true);
  });
});
