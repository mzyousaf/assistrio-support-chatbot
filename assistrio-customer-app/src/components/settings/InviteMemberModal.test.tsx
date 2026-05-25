import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomerBotListItem } from '@/api/types';
import { InviteMemberModal } from './InviteMemberModal';

const mockGetBots = vi.fn();
const mockPostInvite = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getCustomerBots: (...args: unknown[]) => mockGetBots(...args),
  postWorkspaceInvite: (...args: unknown[]) => mockPostInvite(...args),
}));

const bots: CustomerBotListItem[] = [
  {
    _id: 'bot-1',
    name: 'Support Bot',
    agentsPackAgent: false,
    category: 'general',
    status: 'published',
    isPublic: true,
    visibility: 'public',
    createdAt: null,
    slug: 'support',
    primaryColor: '#14B8A6',
    shortDescription: 'Help desk',
    workspaceId: 'ws-1',
  },
  {
    _id: 'bot-2',
    name: 'Sales Bot',
    agentsPackAgent: false,
    category: 'general',
    status: 'draft',
    isPublic: false,
    visibility: 'private',
    createdAt: null,
    slug: 'sales',
    primaryColor: '#0d9488',
    workspaceId: 'ws-1',
  },
];

describe('InviteMemberModal agent access', () => {
  let unmountLast: (() => void) | undefined;

  afterEach(() => {
    unmountLast?.();
    unmountLast = undefined;
    cleanup();
    mockGetBots.mockReset();
    mockPostInvite.mockReset();
  });

  function renderModal(canAssignBotAccess = true) {
    const view = render(
      <InviteMemberModal
        open
        workspaceId="ws-1"
        canAssignBotAccess={canAssignBotAccess}
        onClose={() => undefined}
        onInvited={async () => undefined}
      />,
    );
    unmountLast = view.unmount;
    return view;
  }

  it('loads and shows workspace bots', async () => {
    mockGetBots.mockResolvedValue({ ok: true, data: bots });
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Support Bot')).toBeTruthy();
      expect(screen.getByText('Sales Bot')).toBeTruthy();
    });
    expect(mockGetBots).toHaveBeenCalledWith({ workspaceId: 'ws-1', status: 'all' });
  });

  it('shows empty message when workspace has no bots', async () => {
    mockGetBots.mockResolvedValue({ ok: true, data: [] });
    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/no agents in this workspace yet/i)).toBeTruthy();
    });
  });

  it('role dropdown only offers admin and member', async () => {
    mockGetBots.mockResolvedValue({ ok: true, data: bots });
    renderModal();

    await waitFor(() => expect(screen.getByLabelText(/^role$/i)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/^role$/i));
    await waitFor(() => {
      const labels = screen.getAllByRole('option').map((o) => o.textContent?.trim());
      expect(labels).toContain('Member');
      expect(labels).toContain('Admin');
      expect(labels.some((l) => /owner/i.test(l ?? ''))).toBe(false);
    });
  });

  it('preview toggle enables view', async () => {
    mockGetBots.mockResolvedValue({ ok: true, data: [bots[0]] });
    renderModal();

    await waitFor(() => expect(screen.getByText('Support Bot')).toBeTruthy());

    const viewSwitch = screen.getByRole('switch', { name: 'View access for Support Bot' });
    const previewSwitch = screen.getByRole('switch', { name: 'Preview access for Support Bot' });

    expect(viewSwitch.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(previewSwitch);
    expect(viewSwitch.getAttribute('aria-checked')).toBe('true');
    expect(previewSwitch.getAttribute('aria-checked')).toBe('true');
  });

  it('view off disables preview', async () => {
    mockGetBots.mockResolvedValue({ ok: true, data: [bots[0]] });
    renderModal();

    await waitFor(() => expect(screen.getByText('Support Bot')).toBeTruthy());

    fireEvent.click(screen.getByRole('switch', { name: 'Preview access for Support Bot' }));
    const viewSwitch = screen.getByRole('switch', { name: 'View access for Support Bot' });
    const previewSwitch = screen.getByRole('switch', { name: 'Preview access for Support Bot' });
    expect(previewSwitch.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(viewSwitch);
    expect(viewSwitch.getAttribute('aria-checked')).toBe('false');
    expect(previewSwitch.getAttribute('aria-checked')).toBe('false');
  });

  it('submit includes selected botGrants', async () => {
    mockGetBots.mockResolvedValue({ ok: true, data: bots });
    mockPostInvite.mockResolvedValue({ ok: true, data: { id: 'inv-1', email: 'a@b.com', role: 'member', status: 'pending', expiresAt: '', invitedByUserId: '', acceptedByUserId: null, acceptedAt: null, cancelledAt: null, createdAt: null, updatedAt: null } });

    renderModal();

    await waitFor(() => expect(screen.getByText('Support Bot')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'new@test.com' } });
    fireEvent.click(screen.getByRole('switch', { name: 'View access for Support Bot' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Preview access for Sales Bot' }));
    fireEvent.click(screen.getByRole('button', { name: /^send invite$/i }));

    await waitFor(() => {
      expect(mockPostInvite).toHaveBeenCalledWith('ws-1', {
        email: 'new@test.com',
        role: 'member',
        botGrants: [
          { botId: 'bot-1', canView: true, canPreview: false },
          { botId: 'bot-2', canView: true, canPreview: true },
        ],
      });
    });
  });

  it('submit sends empty botGrants when none selected', async () => {
    mockGetBots.mockResolvedValue({ ok: true, data: bots });
    mockPostInvite.mockResolvedValue({ ok: true, data: { id: 'inv-1', email: 'a@b.com', role: 'admin', status: 'pending', expiresAt: '', invitedByUserId: '', acceptedByUserId: null, acceptedAt: null, cancelledAt: null, createdAt: null, updatedAt: null } });

    renderModal();

    await waitFor(() => expect(screen.getByText('Support Bot')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'admin@test.com' } });
    fireEvent.click(screen.getByLabelText(/^role$/i));
    fireEvent.click(screen.getByRole('option', { name: /^admin$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^send invite$/i }));

    await waitFor(() => {
      expect(mockPostInvite).toHaveBeenCalledWith('ws-1', {
        email: 'admin@test.com',
        role: 'admin',
        botGrants: [],
      });
    });
  });

  it('admin invite hides agent access section and sends empty botGrants', async () => {
    mockPostInvite.mockResolvedValue({
      ok: true,
      data: {
        id: 'inv-1',
        email: 'guest@test.com',
        role: 'member',
        status: 'pending',
        expiresAt: '',
        invitedByUserId: '',
        acceptedByUserId: null,
        acceptedAt: null,
        cancelledAt: null,
        createdAt: null,
        updatedAt: null,
      },
    });

    renderModal(false);

    expect(screen.queryByText('Agent access')).toBeNull();
    expect(screen.getByText(/workspace owner can grant agent access/i)).toBeTruthy();
    expect(mockGetBots).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'guest@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^send invite$/i }));

    await waitFor(() => {
      expect(mockPostInvite).toHaveBeenCalledWith('ws-1', {
        email: 'guest@test.com',
        role: 'member',
        botGrants: [],
      });
    });
  });
});
