import { describe, expect, it } from 'vitest';
import type { CustomerMe } from '../api/types';
import { activeWorkspaceNavbarLabel, resolvePathAfterWorkspaceSwitch } from './workspaceSwitchNavigation';

const baseCustomer: CustomerMe = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-personal',
  workspaceIds: ['ws-personal', 'ws-team'],
  workspaces: [
    {
      id: 'ws-personal',
      name: 'Personal',
      role: 'admin',
      planKey: 'free',
      planName: 'Free',
      subscriptionStatus: 'active',
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 100,
      kbStorageMbPerBot: 10,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      onboardingStatus: 'in_progress',
    },
    {
      id: 'ws-team',
      name: 'Acme Team',
      role: 'member',
      planKey: 'pro',
      planName: 'Pro',
      subscriptionStatus: 'active',
      botLimit: 5,
      memberLimit: 5,
      monthlyAiCredits: 500,
      kbStorageMbPerBot: 50,
      analyticsHistoryDays: 30,
      canExportReports: true,
      showPoweredByAssistrio: false,
      onboardingStatus: 'completed',
    },
  ],
};

describe('workspaceSwitchNavigation', () => {
  it('shows active workspace name only in navbar label', () => {
    expect(activeWorkspaceNavbarLabel(baseCustomer)).toBe('Personal');
  });

  it('routes member workspace switch to /bots', () => {
    const customer: CustomerMe = {
      ...baseCustomer,
      activeWorkspaceId: 'ws-team',
    };
    expect(resolvePathAfterWorkspaceSwitch(customer)).toBe('/bots');
  });

  it('routes incomplete admin workspace switch to /onboarding', () => {
    expect(resolvePathAfterWorkspaceSwitch(baseCustomer)).toBe('/onboarding');
  });

  it('routes completed admin workspace switch to /bots', () => {
    const customer: CustomerMe = {
      ...baseCustomer,
      activeWorkspaceId: 'ws-personal',
      workspaces: baseCustomer.workspaces?.map((ws) =>
        ws.id === 'ws-personal' ? { ...ws, onboardingStatus: 'completed' } : ws,
      ),
    };
    expect(resolvePathAfterWorkspaceSwitch(customer)).toBe('/bots');
  });

  it('routes incomplete owner workspace switch to /onboarding', () => {
    const customer: CustomerMe = {
      ...baseCustomer,
      activeWorkspaceId: 'ws-personal',
      workspaces: baseCustomer.workspaces?.map((ws) =>
        ws.id === 'ws-personal' ? { ...ws, role: 'owner', onboardingStatus: 'in_progress' } : ws,
      ),
    };
    expect(resolvePathAfterWorkspaceSwitch(customer)).toBe('/onboarding');
  });

  it('routes completed owner workspace switch to /bots', () => {
    const customer: CustomerMe = {
      ...baseCustomer,
      activeWorkspaceId: 'ws-personal',
      workspaces: baseCustomer.workspaces?.map((ws) =>
        ws.id === 'ws-personal' ? { ...ws, role: 'owner', onboardingStatus: 'completed' } : ws,
      ),
    };
    expect(resolvePathAfterWorkspaceSwitch(customer)).toBe('/bots');
  });
});
