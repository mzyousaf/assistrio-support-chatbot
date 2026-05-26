import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe } from '@/api/types';
import { UserAccountSettingsPage } from './UserAccountSettingsPage';

const mockSignOut = vi.fn();
const mockRefresh = vi.fn();
const mockCopy = vi.fn();

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: mockCustomer,
    refresh: mockRefresh,
    bootstrapError: null,
  }),
}));

vi.mock('@/auth/useCustomerLogout', () => ({
  useCustomerLogout: () => ({
    signOut: mockSignOut,
    logoutInFlight: false,
  }),
}));

vi.mock('@/lib/copyToClipboard', () => ({
  copyTextToClipboard: (...args: unknown[]) => mockCopy(...args),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn() },
}));

let mockCustomer: CustomerMe | null = {
  id: 'user-1',
  email: 'member@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  firstName: 'Jane',
  lastName: 'Doe',
};

describe('UserAccountSettingsPage', () => {
  beforeEach(() => {
    mockCustomer = {
      id: 'user-1',
      email: 'member@example.com',
      role: 'customer',
      activeWorkspaceId: 'ws-1',
      workspaceIds: ['ws-1'],
      firstName: 'Jane',
      lastName: 'Doe',
    };
    mockCopy.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders user email, account ID, and sign out section', () => {
    render(
      <MemoryRouter>
        <UserAccountSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('User Account')).toBeTruthy();
    expect(screen.getByText('member@example.com')).toBeTruthy();
    expect(screen.getByText('user-1')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Session' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByText('Google account')).toBeTruthy();
  });

  it('copies account ID when copy is clicked', async () => {
    render(
      <MemoryRouter>
        <UserAccountSettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }));

    await waitFor(() => {
      expect(mockCopy).toHaveBeenCalledWith('user-1');
    });
  });

  it('calls sign out from session section', () => {
    render(
      <MemoryRouter>
        <UserAccountSettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
