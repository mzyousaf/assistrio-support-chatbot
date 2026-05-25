import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe } from '../../api/types';
import { SettingsMembersPage } from './SettingsMembersPage';

const mockGetMembers = vi.fn();
const mockGetInvites = vi.fn();

vi.mock('../../api/customerApi', () => ({
  getWorkspaceMembers: (...args: unknown[]) => mockGetMembers(...args),
  getWorkspaceInvites: (...args: unknown[]) => mockGetInvites(...args),
  postWorkspaceInvite: vi.fn(),
  postWorkspaceInviteCancel: vi.fn(),
  postWorkspaceInviteResend: vi.fn(),
  deleteWorkspaceMember: vi.fn(),
}));

const baseWorkspace = {
  id: 'ws-1',
  name: 'Acme',
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
} as const;

const ownerCustomer: CustomerMe = {
  id: 'user-owner',
  email: 'owner@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  workspaces: [{ ...baseWorkspace, role: 'owner' as const }],
};

const adminCustomer: CustomerMe = {
  id: 'user-1',
  email: 'admin@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  workspaces: [{ ...baseWorkspace, role: 'admin' as const }],
};

const memberCustomer: CustomerMe = {
  ...adminCustomer,
  email: 'member@example.com',
  workspaces: [{ ...baseWorkspace, role: 'member' as const }],
};

let mockCustomer: CustomerMe | null = adminCustomer;

vi.mock('../../auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    status: 'authenticated',
    customer: mockCustomer,
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutInFlight: false,
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsMembersPage />
    </MemoryRouter>,
  );
}

describe('SettingsMembersPage', () => {
  beforeEach(() => {
    mockCustomer = adminCustomer;
    mockGetMembers.mockResolvedValue({
      ok: true,
      data: [
        {
          userId: 'user-owner',
          email: 'owner@example.com',
          firstName: 'Owner',
          lastName: 'User',
          picture: null,
          role: 'owner',
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          userId: 'user-1',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          picture: null,
          role: 'admin',
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    mockGetInvites.mockResolvedValue({ ok: true, data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows invite button and seat usage for workspace admins', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /Invite member/i })).toBeTruthy();
    expect(await screen.findByText(/2 of 3 seats used/i)).toBeTruthy();
    expect(await screen.findByText(/Owner User/i)).toBeTruthy();
    expect(await screen.findByText('Owner')).toBeTruthy();
  });

  it('shows invite button and manage UI for workspace owners', async () => {
    mockCustomer = ownerCustomer;
    renderPage();
    expect(await screen.findByRole('button', { name: /Invite member/i })).toBeTruthy();
    expect(mockGetMembers).toHaveBeenCalled();
  });

  it('hides remove action for owner row', async () => {
    renderPage();
    await screen.findByText(/Owner User/i);
    expect(screen.queryByRole('button', { name: /Remove Owner User/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Remove$/i })).toHaveLength(1);
  });

  it('shows read-only message for non-manager members', async () => {
    mockCustomer = memberCustomer;
    renderPage();
    expect(await screen.findByText(/Only workspace owners and admins can manage members/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Invite member/i })).toBeNull();
    expect(mockGetMembers).not.toHaveBeenCalled();
  });

  it('shows empty workspace state when no active workspace', async () => {
    mockCustomer = { ...adminCustomer, activeWorkspaceId: null, workspaces: [] };
    renderPage();
    expect(await screen.findByText(/No active workspace is selected/i)).toBeTruthy();
    await waitFor(() => {
      expect(mockGetMembers).not.toHaveBeenCalled();
    });
  });

  it('does not render default access policy card', async () => {
    renderPage();
    await screen.findByText('Workspace people');
    expect(screen.queryByText('Default access for new agents')).toBeNull();
    expect(screen.queryByText(/These defaults apply only to agents created after this change/i)).toBeNull();
  });

  it('does not render show inactive filter', async () => {
    renderPage();
    await screen.findByText('Workspace people');
    expect(screen.queryByLabelText(/show inactive invites/i)).toBeNull();
    expect(screen.queryByText(/^Show inactive$/i)).toBeNull();
  });

  it('shows active members and pending invites only', async () => {
    mockGetInvites.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'inv-pending',
          email: 'pending@test.com',
          role: 'member',
          status: 'pending',
          expiresAt: '2026-12-01T00:00:00.000Z',
          invitedByUserId: 'user-owner',
          acceptedByUserId: null,
          acceptedAt: null,
          cancelledAt: null,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'inv-expired',
          email: 'expired@test.com',
          role: 'member',
          status: 'expired',
          expiresAt: '2025-01-01T00:00:00.000Z',
          invitedByUserId: 'user-owner',
          acceptedByUserId: null,
          acceptedAt: null,
          cancelledAt: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    });
    renderPage();
    expect(await screen.findByText('pending@test.com')).toBeTruthy();
    expect(await screen.findByText('Pending invite')).toBeTruthy();
    expect(screen.queryByText('expired@test.com')).toBeNull();
  });
});
