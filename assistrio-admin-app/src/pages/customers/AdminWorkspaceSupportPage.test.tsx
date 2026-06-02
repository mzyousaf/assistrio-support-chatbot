import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminWorkspaceSupportPage } from './AdminWorkspaceSupportPage';

const mockGetSupportSummary = vi.fn();
const mockGetUsageAnalytics = vi.fn();
const mockPostReplayWebhook = vi.fn();

vi.mock('@/api/adminApi', () => ({
  getAdminWorkspaceSupportSummary: (...args: unknown[]) => mockGetSupportSummary(...args),
  getAdminWorkspaceUsageAnalytics: (...args: unknown[]) => mockGetUsageAnalytics(...args),
  postAdminReplayWebhookEvent: (...args: unknown[]) => mockPostReplayWebhook(...args),
  getAdminWorkspaceBillingSummary: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  postAdminWorkspaceBillingSync: vi.fn(),
}));

const usageSummary = {
  bots: { current: 1, limit: 1 },
  members: { current: 2, pendingInvites: 1, used: 3, limit: 3 },
  aiCredits: {
    periodStart: '2026-05-01T00:00:00.000Z',
    periodEnd: '2026-06-01T00:00:00.000Z',
    monthlyCredits: 500,
    monthlyCreditsUsed: 120,
    monthlyCreditsRemaining: 380,
    topUpCreditsRemaining: 50,
    totalCreditsAvailable: 550,
    totalCreditsRemaining: 430,
    isOverLimit: false,
    byBot: [],
  },
  trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
  lockedAgentsCount: 1,
  inactiveMembersCount: 1,
};

const supportSummary = {
  workspace: {
    id: 'ws-1',
    name: 'Acme Workspace',
    onboardingStatus: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  owner: { userId: 'u-1', name: 'Owner User', email: 'owner@example.com' },
  subscription: { subscriptionStatus: 'active', provider: 'lemon_squeezy', cancelAtPeriodEnd: false, currentPeriodEnd: '' },
  entitlements: { monthlyAiCredits: 500, botLimit: 1, memberLimit: 3, topUpCreditsRemaining: 0 },
  usage: usageSummary,
  agents: [
    {
      id: 'bot-1',
      name: 'Support Bot',
      status: 'published',
      visibility: 'private',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      isOverLimitLocked: true,
      lockedReason: 'workspace_bot_limit_exceeded',
      sharePreviewEnabled: true,
      sharePreviewStatus: 'active',
      kbUsedMb: 5,
      kbMaxMb: 15,
      conversationCount: 12,
      creditsUsedThisPeriod: 80,
    },
  ],
  members: [
    {
      userId: 'u-1',
      email: 'owner@example.com',
      name: 'Owner User',
      role: 'owner',
      membershipStatus: 'active',
      joinedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      userId: 'u-2',
      email: 'member@example.com',
      name: 'Member User',
      role: 'member',
      membershipStatus: 'inactive_over_limit',
      joinedAt: '2026-02-01T00:00:00.000Z',
    },
  ],
  invites: [
    {
      id: 'inv-1',
      email: 'pending@example.com',
      role: 'member',
      status: 'pending',
      createdAt: '2026-05-01T00:00:00.000Z',
      expiresAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  knowledge: [{ botId: 'bot-1', botName: 'Support Bot', usedMb: 5, maxMb: 15, percentUsed: 33 }],
  conversations: [
    {
      id: 'conv-1',
      botId: 'bot-1',
      botName: 'Support Bot',
      startedFrom: 'runtime_widget',
      messageCount: 8,
      creditsUsed: 4,
      lastActivityAt: '2026-05-20T12:00:00.000Z',
      leadCaptured: true,
      country: 'US',
      device: 'mobile',
    },
  ],
  billing: {
    workspaceId: 'ws-1',
    plan: { key: 'starter', name: 'Starter', priceMonthly: 49, status: 'active', currentPeriodStart: '', currentPeriodEnd: '' },
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
    usage: usageSummary,
    planCatalog: [],
    addonCatalog: [],
    admin: {
      workspaceName: 'Acme Workspace',
      workspaceOwnerEmail: 'owner@example.com',
      subscriptionId: null,
      subscriptionCreatedAt: null,
      subscriptionUpdatedAt: null,
      activeAddons: [],
      topUpCreditsRemaining: 0,
      usageLedgerCount: 0,
    },
    support: {
      provider: {
        provider: 'lemon_squeezy',
        providerCustomerId: 'cust-1',
        providerSubscriptionId: 'sub-1',
        providerVariantId: null,
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: '',
        currentPeriodEnd: '',
      },
      addons: [],
      topUps: [],
      webhookEvents: [
        {
          id: 'evt-1',
          eventName: 'subscription_updated',
          status: 'failed',
          createdAt: '2026-05-20T12:00:00.000Z',
          processedAt: null,
          processingError: 'Invalid payload',
        },
      ],
    },
  },
  webhookHealth: { failedCount: 1, recentFailureCount: 1, lastProcessedAt: null },
  recentEvents: [
    {
      id: 'evt-1',
      eventName: 'subscription_updated',
      status: 'failed',
      createdAt: '2026-05-20T12:00:00.000Z',
      processedAt: null,
      processingError: 'Invalid payload',
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/workspaces/ws-1']}>
      <Routes>
        <Route path="/admin/workspaces/:workspaceId" element={<AdminWorkspaceSupportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminWorkspaceSupportPage', () => {
  afterEach(() => {
    cleanup();
    mockGetSupportSummary.mockReset();
    mockGetUsageAnalytics.mockReset();
    mockPostReplayWebhook.mockReset();
  });

  it('loads workspace support page with overview cards and tabs', async () => {
    mockGetSupportSummary.mockResolvedValue({ ok: true, data: supportSummary });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Acme Workspace' })).toBeTruthy();
    });
    expect(screen.getByText('Owner User')).toBeTruthy();
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Billing')).toBeTruthy();
    expect(screen.getByText('Usage')).toBeTruthy();
    expect(screen.getByText('Agents')).toBeTruthy();
    expect(screen.getByText('Members')).toBeTruthy();
    expect(screen.getByText('Webhooks')).toBeTruthy();
    expect(screen.getByText('120 / 500')).toBeTruthy();
  });

  it('renders locked agents and inactive members in their tabs', async () => {
    mockGetSupportSummary.mockResolvedValue({ ok: true, data: supportSummary });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acme Workspace' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Agents' }));
    await waitFor(() => {
      expect(screen.getByText('workspace_bot_limit_exceeded')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Members' }));
    await waitFor(() => {
      expect(screen.getByText('inactive_over_limit')).toBeTruthy();
      expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders usage cards when usage tab is selected', async () => {
    mockGetSupportSummary.mockResolvedValue({ ok: true, data: supportSummary });
    mockGetUsageAnalytics.mockResolvedValue({
      ok: true,
      data: {
        dateRange: { startDate: '2026-05-01', endDate: '2026-05-31' },
        usageTrend: [{ date: '2026-05-01', totalCreditsUsed: 10, monthlyCreditsUsed: 8, topUpCreditsUsed: 2 }],
        aiCreditsByAgent: [
          {
            botId: 'bot-1',
            botName: 'Support Bot',
            totalCreditsUsed: 80,
            monthlyCreditsUsed: 70,
            topUpCreditsUsed: 10,
            messageCount: 20,
          },
        ],
        trainedKnowledgeByAgent: [],
      },
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acme Workspace' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Usage' }));

    await waitFor(() => {
      expect(screen.getByText('Monthly credits')).toBeTruthy();
      expect(screen.getByText('Support Bot')).toBeTruthy();
    });
    expect(mockGetUsageAnalytics).toHaveBeenCalledWith('ws-1', expect.any(Object));
  });

  it('webhook replay button works on webhooks tab', async () => {
    mockGetSupportSummary.mockResolvedValue({ ok: true, data: supportSummary });
    mockPostReplayWebhook.mockResolvedValue({
      ok: true,
      data: { replayed: true, status: 'processed', message: 'Webhook event replayed successfully.' },
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Acme Workspace' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Webhooks' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));

    await waitFor(() => {
      expect(mockPostReplayWebhook).toHaveBeenCalledWith('evt-1');
      expect(screen.getByText('Webhook event replayed successfully.')).toBeTruthy();
    });
  });

  it('shows empty-state friendly error when workspace is missing', async () => {
    mockGetSupportSummary.mockResolvedValue({ ok: false, error: 'Workspace not found.' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Could not load workspace')).toBeTruthy();
      expect(screen.getByText('Workspace not found.')).toBeTruthy();
    });
  });
});
