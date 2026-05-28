import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe } from '@/api/types';
import { appToast } from '@/lib/app-toast';
import { WorkspaceSettingsPage } from './WorkspaceSettingsPage';

const mockPatchWorkspace = vi.fn();
const mockDeleteWorkspace = vi.fn();
const mockApplyCustomerSession = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/api/customerApi', () => ({
  patchWorkspace: (...args: unknown[]) => mockPatchWorkspace(...args),
  deleteWorkspace: (...args: unknown[]) => mockDeleteWorkspace(...args),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
  useCustomerAuth: () => ({
    customer: mockCustomer,
    applyCustomerSession: mockApplyCustomerSession,
  }),
}));

describe('WorkspaceSettingsPage', () => {
  function requireWorkspaceFixture() {
    const ws = mockCustomer?.workspaces?.[0];
    if (!ws) throw new Error('missing workspace fixture');
    return ws;
  }

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
    expect((screen.getByLabelText('Workspace name') as HTMLInputElement).value).toBe('Acme Workspace');
    expect(screen.getByRole('button', { name: /^Update settings$/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Danger zone')).toBeTruthy();
  });

  it('enables Save when workspace name is edited', () => {
    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    const saveButton = screen.getByRole('button', { name: /^Update settings$/i });
    expect(saveButton.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Acme Workspace Updated' },
    });
    expect(saveButton.hasAttribute('disabled')).toBe(false);
  });

  it('owner can save workspace name and updates session', async () => {
    const baseWs = requireWorkspaceFixture();
    mockPatchWorkspace.mockResolvedValue({
      ok: true,
      data: {
        workspace: { id: 'ws-1', name: 'Acme Workspace Updated' },
        session: {
          ...mockCustomer!,
          workspaces: [{ ...baseWs, name: 'Acme Workspace Updated' }],
        },
      },
    });

    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Acme Workspace Updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Update settings$/i }));

    await waitFor(() => {
      expect(mockPatchWorkspace).toHaveBeenCalledWith('ws-1', { name: 'Acme Workspace Updated' });
    });
    expect(mockApplyCustomerSession).toHaveBeenCalled();
    expect(appToast.success).toHaveBeenCalledWith('Workspace name saved.');
  });

  it('shows paid-workspace delete lock copy for free plan owner', () => {
    const baseWs = requireWorkspaceFixture();
    mockCustomer = {
      ...mockCustomer!,
      workspaces: [{ ...baseWs, planKey: 'free', subscriptionStatus: 'free' }],
    };

    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Workspace deletion is available for paid workspaces.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Delete workspace$/i }).hasAttribute('disabled')).toBe(true);
  });

  it('member sees read-only workspace name input', () => {
    const baseWs = requireWorkspaceFixture();
    mockCustomer = {
      ...mockCustomer!,
      workspaces: [{ ...baseWs, role: 'member' }],
    };

    render(
      <MemoryRouter>
        <WorkspaceSettingsPage />
      </MemoryRouter>,
    );

    expect((screen.getByLabelText('Workspace name') as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: /^Update settings$/i })).toBeNull();
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
});
