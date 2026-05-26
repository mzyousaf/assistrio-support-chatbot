import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe, WorkspaceBillingSummary } from '@/api/types';
import { WorkspaceSettingsPage } from './WorkspaceSettingsPage';

const mockGetBillingSummary = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: (...args: unknown[]) => mockGetBillingSummary(...args),
}));

const baseWorkspace = {
  id: 'ws-1',
  name: 'Acme Workspace',
  role: 'owner' as const,
  planKey: 'starter',
  planName: 'Starter',
  subscriptionStatus: 'active',
  botLimit: 1,
  memberLimit: 3,
  monthlyAiCredits: 500,
  kbStorageMbPerBot: 15,
  analyticsHistoryDays: null,
  canExportReports: true,
  showPoweredByAssistrio: true,
};

let mockCustomer: CustomerMe | null = {
  id: 'user-1',
  email: 'owner@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  workspaces: [baseWorkspace],
};

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ customer: mockCustomer }),
}));

function buildSummary(): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'starter',
      name: 'Starter',
      priceMonthly: 49,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    },
    entitlements: {
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 500,
      kbStorageMbPerBot: 15,
      maxKbStorageMbPerBot: 40,
      analyticsHistoryDays: null,
      canExportReports: true,
      showPoweredByAssistrio: true,
      canRemoveBranding: false,
      activeAddons: [],
      topUpCreditsRemaining: 0,
    },
    usage: {
      bots: { current: 1, limit: 1 },
      members: { current: 2, pendingInvites: 1, used: 3, limit: 3 },
      aiCredits: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
        monthlyCredits: 500,
        monthlyCreditsUsed: 120,
        monthlyCreditsRemaining: 380,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 500,
        totalCreditsRemaining: 380,
        isOverLimit: false,
        byBot: [],
      },
      trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: 'Per-agent trained knowledge usage.' },
    },
    planCatalog: [],
    addonCatalog: [],
  };
}

describe('WorkspaceSettingsPage', () => {
  beforeEach(() => {
    mockCustomer = {
      id: 'user-1',
      email: 'owner@example.com',
      role: 'customer',
      activeWorkspaceId: 'ws-1',
      workspaceIds: ['ws-1'],
      workspaces: [baseWorkspace],
    };
    mockGetBillingSummary.mockResolvedValue({ ok: true, data: buildSummary() });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders workspace name, role, plan, and limits summary', async () => {
    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Workspace')).toBeTruthy();
    expect(screen.getAllByText('Acme Workspace').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getAllByText('Starter').length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText('1 / 1')).toBeTruthy();
    });
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(screen.getByText('120 / 500')).toBeTruthy();
    expect(screen.getByText('15 MB / bot')).toBeTruthy();
  });

  it('shows empty state when no active workspace is selected', () => {
    mockCustomer = {
      id: 'user-1',
      email: 'owner@example.com',
      role: 'customer',
      activeWorkspaceId: null,
      workspaceIds: [],
      workspaces: [],
    };

    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/no active workspace selected/i)).toBeTruthy();
    expect(mockGetBillingSummary).not.toHaveBeenCalled();
  });
});
