import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentShareAccessModal } from './AgentShareAccessModal';
import type { CustomerBotListItem } from '@/api/types';

const mockGetGrants = vi.fn();
const mockPatchGrants = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getCustomerBotAccessGrants: (...args: unknown[]) => mockGetGrants(...args),
  patchCustomerBotAccessGrants: (...args: unknown[]) => mockPatchGrants(...args),
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

    fireEvent.click(screen.getByRole('switch', { name: /can view for member@test.com/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockPatchGrants).toHaveBeenCalled();
    });
  });
});
