import { describe, expect, it } from 'vitest';
import type { CustomerMe } from '../api/types';
import { canManageActiveWorkspace } from './canManageActiveWorkspace';

const baseWorkspace = {
  id: 'ws-1',
  name: 'Team',
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
} as const;

const baseCustomer: CustomerMe = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  workspaces: [{ ...baseWorkspace, role: 'admin' }],
};

describe('canManageActiveWorkspace', () => {
  it('returns true for workspace owner', () => {
    expect(
      canManageActiveWorkspace({
        ...baseCustomer,
        workspaces: [{ ...baseWorkspace, role: 'owner' }],
      }),
    ).toBe(true);
  });

  it('returns true for workspace admin', () => {
    expect(canManageActiveWorkspace(baseCustomer)).toBe(true);
  });

  it('returns false for workspace member', () => {
    expect(
      canManageActiveWorkspace({
        ...baseCustomer,
        workspaces: [{ ...baseWorkspace, role: 'member' }],
      }),
    ).toBe(false);
  });
});
