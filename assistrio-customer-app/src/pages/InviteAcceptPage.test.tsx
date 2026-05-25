import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteAcceptPage } from './InviteAcceptPage';

const mockGetPreview = vi.fn();
const mockPostAccept = vi.fn();
const mockRefresh = vi.fn();
const mockLogout = vi.fn();

vi.mock('../api/customerApi', () => ({
  getCustomerInvitePreview: (...args: unknown[]) => mockGetPreview(...args),
  postCustomerInviteAccept: (...args: unknown[]) => mockPostAccept(...args),
}));

vi.mock('../api/client', () => ({
  customerGoogleAuthStartUrl: ({ inviteToken }: { inviteToken?: string }) =>
    `https://api.test/api/customer/auth/google?inviteToken=${encodeURIComponent(inviteToken ?? '')}&selectAccount=1`,
}));

vi.mock('../auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    status: 'anonymous',
    customer: null,
    refresh: mockRefresh,
    logout: mockLogout,
    logoutInFlight: false,
  }),
}));

function renderPage(token = 'invite-token', search = '') {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}${search}`]}>
      <Routes>
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InviteAcceptPage', () => {
  beforeEach(() => {
    mockGetPreview.mockResolvedValue({
      ok: true,
      data: {
        workspaceName: 'Acme Team',
        invitedEmail: 'guest@example.com',
        role: 'member',
        expiresAt: '2026-06-01T12:00:00.000Z',
        inviterEmail: 'owner@example.com',
        inviterName: 'Owner User',
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders invite preview and Google CTA for anonymous users', async () => {
    renderPage();
    expect(await screen.findByText(/Acme Team/)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Continue with Google/i });
    expect(link.getAttribute('href')).toBe(
      'https://api.test/api/customer/auth/google?inviteToken=invite-token&selectAccount=1',
    );
  });

  it('shows error state for expired invite preview', async () => {
    mockGetPreview.mockResolvedValueOnce({
      ok: false,
      status: 410,
      error: 'gone',
      errorCode: 'workspace_invite_expired',
      body: { errorCode: 'workspace_invite_expired' },
    });
    renderPage();
    expect(await screen.findByText(/Invite expired/i)).toBeTruthy();
  });

  it('shows oauth callback mismatch banner when error query is present', async () => {
    renderPage('invite-token', '?error=workspace_invite_email_mismatch');
    await waitFor(() => expect(mockGetPreview).toHaveBeenCalled());
    expect(await screen.findByText(/Wrong Google account/i)).toBeTruthy();
  });
});
