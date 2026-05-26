import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe } from '@/api/types';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

const mockNavigate = vi.fn();
const mockActivate = vi.fn();

vi.mock('@/lib/app-toast', () => ({
  appToast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const personalWorkspace = {
  id: 'ws-personal',
  name: 'Personal',
  role: 'admin' as const,
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
  onboardingStatus: 'in_progress' as const,
};

const teamWorkspace = {
  id: 'ws-team',
  name: 'Acme Team',
  role: 'member' as const,
  planKey: 'pro',
  planName: 'Pro',
  subscriptionStatus: 'active',
  botLimit: 5,
  memberLimit: 5,
  monthlyAiCredits: 500,
  kbStorageMbPerBot: 50,
  analyticsHistoryDays: 30,
  canExportReports: true,
  showPoweredByAssistrio: false,
  onboardingStatus: 'completed' as const,
};

const customer: CustomerMe = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-personal',
  workspaceIds: ['ws-personal', 'ws-team'],
  workspaces: [personalWorkspace, teamWorkspace],
};

function renderSwitcher(activeCustomer: CustomerMe = customer) {
  return render(
    <MemoryRouter>
      <WorkspaceSwitcher
        customer={activeCustomer}
        activateWorkspace={mockActivate}
        navigate={mockNavigate}
      />
    </MemoryRouter>,
  );
}

function openMenu() {
  fireEvent.click(screen.getByLabelText('Workspace menu'));
}

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    mockActivate.mockReset();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows active workspace label with plan badge', () => {
    renderSwitcher();
    expect(screen.getByTitle('Personal')).toBeTruthy();
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
    openMenu();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('lists all workspaces in the dropdown', () => {
    renderSwitcher();
    openMenu();
    expect(screen.getByRole('option', { name: /Personal Admin Free/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Acme Team Member Pro/i })).toBeTruthy();
  });

  it('disables the active workspace option', () => {
    renderSwitcher();
    openMenu();
    const activeOption = screen.getByRole('option', { name: /Personal Admin Free/i });
    expect(activeOption.hasAttribute('disabled')).toBe(true);
    expect(activeOption.getAttribute('aria-selected')).toBe('true');
  });

  it('calls activate API and navigates to /bots for member workspace', async () => {
    mockActivate.mockResolvedValue({
      ...customer,
      activeWorkspaceId: 'ws-team',
    });
    renderSwitcher();
    openMenu();
    fireEvent.click(screen.getByRole('option', { name: /Acme Team Member Pro/i }));
    await waitFor(() => {
      expect(mockActivate).toHaveBeenCalledWith('ws-team');
      expect(mockNavigate).toHaveBeenCalledWith('/bots', { replace: true });
    });
  });

  it('navigates to /onboarding for incomplete admin workspace', async () => {
    mockActivate.mockResolvedValue({
      ...customer,
      activeWorkspaceId: 'ws-personal',
      workspaces: [personalWorkspace, teamWorkspace],
    });
    renderSwitcher({
      ...customer,
      activeWorkspaceId: 'ws-team',
      workspaces: [personalWorkspace, teamWorkspace],
    });
    openMenu();
    fireEvent.click(screen.getByRole('option', { name: /Personal Admin Free/i }));
    await waitFor(() => {
      expect(mockActivate).toHaveBeenCalledWith('ws-personal');
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true });
    });
  });

  it('navigates to /bots for completed admin workspace', async () => {
    const completedPersonal = { ...personalWorkspace, onboardingStatus: 'completed' as const };
    mockActivate.mockResolvedValue({
      ...customer,
      activeWorkspaceId: 'ws-personal',
      workspaces: [completedPersonal, teamWorkspace],
    });
    renderSwitcher({
      ...customer,
      activeWorkspaceId: 'ws-team',
      workspaces: [completedPersonal, teamWorkspace],
    });
    openMenu();
    fireEvent.click(screen.getByRole('option', { name: /Personal Admin Free/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/bots', { replace: true });
    });
  });

  it('shows Owner badge for owner workspace', () => {
    const ownerWorkspace = {
      ...personalWorkspace,
      id: 'ws-owned',
      name: 'Owned Co',
      role: 'owner' as const,
    };
    renderSwitcher({
      ...customer,
      activeWorkspaceId: 'ws-owned',
      workspaces: [ownerWorkspace, teamWorkspace],
    });
    openMenu();
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
  });

  it('navigates to /onboarding for incomplete owner workspace', async () => {
    const ownerWorkspace = {
      ...personalWorkspace,
      id: 'ws-owned',
      name: 'Owned Co',
      role: 'owner' as const,
      onboardingStatus: 'in_progress' as const,
    };
    mockActivate.mockResolvedValue({
      ...customer,
      activeWorkspaceId: 'ws-owned',
      workspaces: [ownerWorkspace, teamWorkspace],
    });
    renderSwitcher({
      ...customer,
      activeWorkspaceId: 'ws-team',
      workspaces: [ownerWorkspace, teamWorkspace],
    });
    openMenu();
    fireEvent.click(screen.getByRole('option', { name: /Owned Co Owner Free/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true });
    });
  });

  it('navigates to /bots for completed owner workspace', async () => {
    const ownerWorkspace = {
      ...personalWorkspace,
      id: 'ws-owned',
      name: 'Owned Co',
      role: 'owner' as const,
      onboardingStatus: 'completed' as const,
    };
    mockActivate.mockResolvedValue({
      ...customer,
      activeWorkspaceId: 'ws-owned',
      workspaces: [ownerWorkspace, teamWorkspace],
    });
    renderSwitcher({
      ...customer,
      activeWorkspaceId: 'ws-team',
      workspaces: [ownerWorkspace, teamWorkspace],
    });
    openMenu();
    fireEvent.click(screen.getByRole('option', { name: /Owned Co Owner Free/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/bots', { replace: true });
    });
  });
});
