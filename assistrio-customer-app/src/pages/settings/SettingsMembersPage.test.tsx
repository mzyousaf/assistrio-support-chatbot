import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe } from '../../api/types';
import { SettingsMembersPage } from './SettingsMembersPage';

const mockGetMembers = vi.fn();
const mockGetInvites = vi.fn();
const mockPatchMemberRole = vi.fn();
const mockPatchInviteRole = vi.fn();

vi.mock('../../api/customerApi', () => ({
  getWorkspaceMembers: (...args: unknown[]) => mockGetMembers(...args),
  getWorkspaceInvites: (...args: unknown[]) => mockGetInvites(...args),
  patchWorkspaceMemberRole: (...args: unknown[]) => mockPatchMemberRole(...args),
  patchWorkspaceInviteRole: (...args: unknown[]) => mockPatchInviteRole(...args),
  postWorkspaceInvite: vi.fn(),
  postWorkspaceInviteCancel: vi.fn(),
  postWorkspaceInviteResend: vi.fn(),
  deleteWorkspaceMember: vi.fn(),
  getCustomerBots: vi.fn().mockResolvedValue({ ok: true, data: [] }),
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
    mockPatchMemberRole.mockResolvedValue({ ok: true, data: {} });
    mockPatchInviteRole.mockResolvedValue({ ok: true, data: {} });
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

  it('shows loading skeleton while fetching members', async () => {
    let resolveMembers: (value: unknown) => void = () => undefined;
    let resolveInvites: (value: unknown) => void = () => undefined;
    mockGetMembers.mockReturnValue(
      new Promise((resolve) => {
        resolveMembers = resolve;
      }),
    );
    mockGetInvites.mockReturnValue(
      new Promise((resolve) => {
        resolveInvites = resolve;
      }),
    );

    renderPage();

    expect(await screen.findByLabelText('Loading members')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3, name: 'Members' })).toBeNull();

    resolveMembers({ ok: true, data: [] });
    resolveInvites({ ok: true, data: [] });

    expect(await screen.findByRole('heading', { level: 3, name: 'Members' })).toBeTruthy();
  });

  it('renders seat usage cards outside workspace people card', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 3, name: 'Members' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Members Management' })).toBeTruthy();
    expect(screen.queryByText('Seat usage')).toBeNull();
    expect(screen.queryByText('Free plan')).toBeNull();
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByText('Active members')).toBeTruthy();
    expect(screen.getByText('Pending invites')).toBeTruthy();
    expect(screen.queryByText('Seats remaining')).toBeNull();
    expect(screen.queryByText('Total seats')).toBeNull();

    const peopleCard = document.getElementById('workspace-people');
    const seatUsage = document.getElementById('members-seat-usage');
    expect(peopleCard).toBeTruthy();
    expect(seatUsage).toBeTruthy();
    expect(peopleCard?.contains(seatUsage ?? null)).toBe(false);
  });

  it('shows invite button and opens invite modal from header', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Invite member/i }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('shows subtle invite hint when only the owner is present', async () => {
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
      ],
    });
    renderPage();
    expect(await screen.findByText('Invite teammates to collaborate on this workspace.')).toBeTruthy();
    expect(screen.queryByText('Add teammates to collaborate with AI')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Invite member/i })).toHaveLength(1);
  });

  it('renders role and status badges in people table', async () => {
    renderPage();
    await screen.findByText(/Owner User/i);
    expect(screen.getByRole('heading', { level: 3, name: 'Members' })).toBeTruthy();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
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
    expect(screen.getByRole('button', { name: /Remove Admin User/i })).toBeTruthy();
  });

  it('renders pending invite actions', async () => {
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
      ],
    });
    renderPage();
    expect(await screen.findByText('Pending invite')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resend invite to pending@test.com/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cancel invite for pending@test.com/i })).toBeTruthy();
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
    expect(screen.queryByText('expired@test.com')).toBeNull();
  });

  it('shows retry on load error', async () => {
    mockGetMembers.mockResolvedValueOnce({ ok: false, error: 'Network error' });
    renderPage();
    expect(await screen.findByText('Could not load members')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('reverts role selection when member role update fails', async () => {
    mockCustomer = ownerCustomer;
    mockPatchMemberRole.mockResolvedValueOnce({ ok: false, error: 'Role update failed' });
    renderPage();
    await screen.findByText(/Admin User/i);

    const roleTrigger = screen.getByRole('button', { name: /Role for admin@example.com/i });
    expect(roleTrigger.textContent).toContain('Admin');

    fireEvent.click(roleTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Member' }));

    await waitFor(() => {
      expect(mockPatchMemberRole).toHaveBeenCalledWith('ws-1', 'user-1', 'member');
    });
    await waitFor(() => {
      expect(roleTrigger.textContent).toContain('Admin');
    });
  });
});
