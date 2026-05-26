import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteAcceptPage } from './InviteAcceptPage';

const mockGetPreview = vi.fn();
const mockPostAccept = vi.fn();
const mockRefresh = vi.fn();
const mockLogout = vi.fn();
const mockNavigate = vi.fn();

let authStatus: 'anonymous' | 'authenticated' | 'loading' = 'anonymous';
let authCustomer: { email: string } | null = null;

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
    status: authStatus,
    customer: authCustomer,
    refresh: mockRefresh,
    logout: mockLogout,
    logoutInFlight: false,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
    authStatus = 'anonymous';
    authCustomer = null;
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
    mockPostAccept.mockResolvedValue({ ok: true, data: {} });
    mockRefresh.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows shared loading state while checking invitation', () => {
    mockGetPreview.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Checking invitation…')).toBeTruthy();
  });

  it('shows CTA spinner while auth session is loading', async () => {
    authStatus = 'loading';
    renderPage();
    expect(await screen.findByText('Acme Team')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Continue with Google/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Accept invitation/i })).toBeNull();
    expect(screen.getByRole('status', { name: /Checking your account/i })).toBeTruthy();
  });

  it('renders invite preview and Google CTA for anonymous users', async () => {
    renderPage();
    expect(await screen.findByText('Acme Team')).toBeTruthy();
    expect(screen.getByText('Workspace invite')).toBeTruthy();
    expect(screen.queryByText(/invited you to collaborate/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Accept invitation/i })).toBeNull();
    const link = screen.getByRole('link', { name: /Continue with Google/i });
    expect(link.getAttribute('href')).toBe(
      'https://api.test/api/customer/auth/google?inviteToken=invite-token&selectAccount=1',
    );
    expect(screen.getByText(/By continuing, you agree to our/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Terms of Service/i }).getAttribute('href')).toMatch(/\/terms$/);
    expect(screen.getByRole('link', { name: /Privacy Policy/i }).getAttribute('href')).toMatch(/\/privacy$/);
    expect(screen.getByText('Owner User')).toBeTruthy();
    expect(screen.getByText('Member')).toBeTruthy();
  });

  it('shows cancelled invite state with login action and secondary guidance', async () => {
    mockGetPreview.mockResolvedValueOnce({
      ok: false,
      status: 410,
      error: 'gone',
      errorCode: 'workspace_invite_cancelled',
      body: { errorCode: 'workspace_invite_cancelled' },
    });
    renderPage();
    expect(await screen.findByText(/Invite cancelled/i)).toBeTruthy();
    expect(screen.getByText(/cancelled by a workspace admin/i)).toBeTruthy();
    expect(screen.getByText(/send you a new invitation/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Go to login/i })).toBeTruthy();
  });

  it('shows expired invite state with guidance', async () => {
    mockGetPreview.mockResolvedValueOnce({
      ok: false,
      status: 410,
      error: 'gone',
      errorCode: 'workspace_invite_expired',
      body: { errorCode: 'workspace_invite_expired' },
    });
    renderPage();
    expect(await screen.findByText(/Invite expired/i)).toBeTruthy();
    expect(screen.getByText(/This invitation link has expired/i)).toBeTruthy();
    expect(screen.getByText(/send a new invite/i)).toBeTruthy();
  });

  it('shows invalid invite state with back action', async () => {
    mockGetPreview.mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: 'not found',
      errorCode: 'workspace_invite_not_found',
      body: { errorCode: 'workspace_invite_not_found' },
    });
    renderPage();
    expect(await screen.findByText(/Invite not found/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to Assistrio/i }).getAttribute('href')).toBe(
      'http://localhost:3001',
    );
  });

  it('shows already accepted state for anonymous users', async () => {
    mockGetPreview.mockResolvedValueOnce({
      ok: false,
      status: 410,
      error: 'gone',
      errorCode: 'workspace_invite_already_accepted',
      body: { errorCode: 'workspace_invite_already_accepted' },
    });
    renderPage();
    expect(await screen.findByText(/already in this workspace/i)).toBeTruthy();
  });

  it('auto-routes authenticated users when invite is already accepted', async () => {
    authStatus = 'authenticated';
    authCustomer = { email: 'guest@example.com' };
    mockGetPreview.mockResolvedValueOnce({
      ok: false,
      status: 410,
      error: 'gone',
      errorCode: 'workspace_invite_already_accepted',
      body: { errorCode: 'workspace_invite_already_accepted' },
    });
    renderPage();
    expect(await screen.findByText('Joining workspace…')).toBeTruthy();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/bots', { replace: true }));
    expect(screen.queryByRole('button', { name: /Open workspace/i })).toBeNull();
  });

  it('shows oauth callback mismatch banner when error query is present', async () => {
    renderPage('invite-token', '?error=workspace_invite_email_mismatch');
    await waitFor(() => expect(mockGetPreview).toHaveBeenCalled());
    expect(await screen.findByText(/Wrong Google account/i)).toBeTruthy();
  });

  it('accepts invite for authenticated users and routes to workspace', async () => {
    authStatus = 'authenticated';
    authCustomer = { email: 'guest@example.com' };
    renderPage();
    expect(await screen.findByRole('button', { name: /Accept invitation/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Accept invitation/i }));
    expect(await screen.findByText('Joining workspace…')).toBeTruthy();
    await waitFor(() => expect(mockPostAccept).toHaveBeenCalledWith('invite-token'));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/bots', { replace: true });
  });

  it('includes copyright footer', async () => {
    renderPage();
    await waitFor(() => expect(mockGetPreview).toHaveBeenCalled());
    expect(screen.getByText(/Assistrio\. All rights reserved\./i)).toBeTruthy();
  });
});
