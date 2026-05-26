import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe } from '@/api/types';
import { appToast } from '@/lib/app-toast';
import { WorkspaceSettingsPage } from './WorkspaceSettingsPage';

vi.mock('@/lib/app-toast', () => ({
  appToast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

let mockCustomer: CustomerMe | null = {
  id: 'user-1',
  email: 'owner@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  workspaces: [
    {
      id: 'ws-1',
      name: 'Acme Workspace',
      role: 'owner',
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
    },
  ],
};

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ customer: mockCustomer }),
}));

describe('WorkspaceSettingsPage', () => {
  beforeEach(() => {
    mockCustomer = {
      id: 'user-1',
      email: 'owner@example.com',
      role: 'customer',
      activeWorkspaceId: 'ws-1',
      workspaceIds: ['ws-1'],
      workspaces: [
        {
          id: 'ws-1',
          name: 'Acme Workspace',
          role: 'owner',
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
        },
      ],
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders workspace details and danger zone', () => {
    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.getByText(/View workspace details and manage permanent deletion/i)).toBeTruthy();
    expect(screen.getByText('Workspace details')).toBeTruthy();
    expect((screen.getByLabelText('Workspace name') as HTMLInputElement).value).toBe('Acme Workspace');
    expect(screen.getByText('ws-1')).toBeTruthy();
    expect(screen.getByText('Danger zone')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Delete workspace/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Workspace limits')).toBeNull();
    expect(screen.queryByText('Access and collaboration')).toBeNull();
    expect(screen.queryByText('Workspace actions')).toBeNull();
  });

  it('shows unsaved helper and placeholder save toast when workspace name changes', () => {
    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Acme Workspace Updated' },
    });

    expect(screen.getByText('Workspace name changes are not saved yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(appToast.info).toHaveBeenCalledWith('Workspace name editing is not connected yet.');
  });

  it('requires typed confirmation before enabling delete in modal', () => {
    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Delete workspace/i })[0]!);
    const modalDeleteButtons = screen.getAllByRole('button', { name: /^Delete workspace$/i });
    const modalDeleteButton = modalDeleteButtons[modalDeleteButtons.length - 1]!;
    expect(modalDeleteButton.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText(/Type the workspace name to confirm/i), {
      target: { value: 'Acme Workspace' },
    });
    expect(modalDeleteButton.hasAttribute('disabled')).toBe(false);
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
  });
});
