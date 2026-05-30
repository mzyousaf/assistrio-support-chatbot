import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';import { AgentShareAccessModal } from './AgentShareAccessModal';
import type { CustomerBotListItem } from '@/api/types';

const mockGetGrants = vi.fn();
const mockPatchGrants = vi.fn();
const mockGetMembers = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getCustomerBotAccessGrants: (...args: unknown[]) => mockGetGrants(...args),
  patchCustomerBotAccessGrants: (...args: unknown[]) => mockPatchGrants(...args),
  getWorkspaceMembers: (...args: unknown[]) => mockGetMembers(...args),
}));

const bot: CustomerBotListItem = {
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
  workspaceId: 'ws-1',
};

describe('AgentShareAccessModal', () => {
  afterEach(() => {
    cleanup();
    mockGetGrants.mockReset();
    mockPatchGrants.mockReset();
    mockGetMembers.mockReset();
  });

  beforeEach(() => {
    mockGetMembers.mockResolvedValue({ ok: true, data: [] });
  });

  it('loads grants and saves toggles', async () => {
    mockGetGrants.mockResolvedValue({
      ok: true,
      data: {
        botId: 'bot-1',
        workspaceId: 'ws-1',
        grants: [
          {
            subjectType: 'user',
            userId: 'user-owner',
            email: 'owner@test.com',
            displayName: 'Owner User',
            status: 'active',
            role: 'owner',
            canView: true,
            canPreview: true,
            locked: true,
          },
          {
            subjectType: 'user',
            userId: 'user-2',
            email: 'member@test.com',
            displayName: 'Member User',
            status: 'active',
            role: 'member',
            canView: false,
            canPreview: false,
            locked: false,
          },
        ],
      },
    });
    mockPatchGrants.mockResolvedValue({ ok: true, data: { botId: 'bot-1', workspaceId: 'ws-1', grants: [] } });

    render(<AgentShareAccessModal open bot={bot} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('member@test.com')).toBeTruthy();
    });
    expect(screen.queryByText('owner@test.com')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /can view for member@test.com/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockPatchGrants).toHaveBeenCalled();
    });
  });

  it('renders user column with avatar initials and checkboxes', async () => {
    mockGetGrants.mockResolvedValue({
      ok: true,
      data: {
        botId: 'bot-1',
        workspaceId: 'ws-1',
        grants: [
          {
            subjectType: 'user',
            userId: 'user-2',
            email: 'member@test.com',
            displayName: 'Member User',
            firstName: 'Member',
            lastName: 'User',
            avatarUrl: 'https://cdn.example.com/avatar.png',
            picture: null,
            status: 'active',
            role: 'member',
            canView: false,
            canPreview: false,
            locked: false,
          },
        ],
      },
    });

    render(<AgentShareAccessModal open bot={bot} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('Member User')).toBeTruthy();
    });
    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.queryByText('Status')).toBeNull();
    expect(document.querySelector('img[src*="avatar.png"]')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /can view for member@test.com/i })).toBeTruthy();
  });

  it('does not show cancelled invites or accepted duplicate rows', async () => {
    mockGetGrants.mockResolvedValue({
      ok: true,
      data: {
        botId: 'bot-1',
        workspaceId: 'ws-1',
        grants: [
          {
            subjectType: 'user',
            userId: 'user-2',
            email: 'member@test.com',
            displayName: 'Member User',
            status: 'active',
            role: 'member',
            canView: true,
            canPreview: false,
            locked: false,
          },
          {
            subjectType: 'invite',
            inviteId: 'inv-cancelled',
            email: 'cancelled@test.com',
            displayName: 'cancelled@test.com',
            status: 'cancelled',
            role: 'member',
            canView: false,
            canPreview: false,
            locked: false,
          },
          {
            subjectType: 'invite',
            inviteId: 'inv-dup',
            email: 'member@test.com',
            displayName: 'member@test.com',
            status: 'pending_invite',
            role: 'member',
            canView: false,
            canPreview: false,
            locked: false,
          },
        ],
      },
    });

    render(<AgentShareAccessModal open bot={bot} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('member@test.com')).toBeTruthy();
    });
    expect(screen.queryByText('cancelled@test.com')).toBeNull();
    expect(screen.getAllByText('member@test.com')).toHaveLength(1);
  });

  it('uses workspace member avatar when grant row is missing profile image fields', async () => {
    mockGetGrants.mockResolvedValue({
      ok: true,
      data: {
        botId: 'bot-1',
        workspaceId: 'ws-1',
        grants: [
          {
            subjectType: 'user',
            userId: 'user-2',
            email: 'member@test.com',
            displayName: 'Member User',
            status: 'active',
            role: 'member',
            canView: false,
            canPreview: false,
            locked: false,
          },
        ],
      },
    });
    mockGetMembers.mockResolvedValue({
      ok: true,
      data: [
        {
          userId: 'user-2',
          email: 'member@test.com',
          firstName: 'Member',
          lastName: 'User',
          picture: 'https://lh3.googleusercontent.com/a/google-photo',
          displayName: 'Member User',
          avatarUrl: 'https://lh3.googleusercontent.com/a/google-photo',
          role: 'member',
          joinedAt: null,
        },
      ],
    });

    render(<AgentShareAccessModal open bot={bot} onClose={() => undefined} />);

    await waitFor(() => {
      expect(document.querySelector('img[src*="google-photo"]')).toBeTruthy();
    });
  });
});
