import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceBillingProfile } from '@/api/types';
import { clearWorkspaceBillingProfileCache } from '@/lib/workspaceBillingProfileStore';
import { WorkspaceBillingProfileSection } from '@/pages/billing/WorkspaceBillingProfileSection';

const mockGetWorkspaceBillingProfile = vi.fn();
const mockPatchWorkspaceBillingProfile = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingProfile: (...args: unknown[]) => mockGetWorkspaceBillingProfile(...args),
  patchWorkspaceBillingProfile: (...args: unknown[]) => mockPatchWorkspaceBillingProfile(...args),
}));

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: {
      id: 'user-1',
      email: 'owner@example.com',
      activeWorkspaceId: 'ws-1',
      workspaceIds: ['ws-1'],
      workspaces: [{ id: 'ws-1', name: 'Acme Workspace', role: 'owner' }],
    },
  }),
}));

const savedProfile: WorkspaceBillingProfile = {
  workspaceId: 'ws-1',
  name: 'Acme Inc',
  address: '123 Mall Road',
  city: 'Lahore',
  zipCode: '54000',
  country: 'PK',
  taxId: 'TAX-12345',
  notes: 'Include PO number on invoices.',
  updatedAt: '2026-05-01T00:00:00.000Z',
  updatedBy: 'user-1',
};

describe('WorkspaceBillingProfileSection', () => {
  beforeEach(() => {
    clearWorkspaceBillingProfileCache();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    clearWorkspaceBillingProfileCache();
  });

  it('shows saved billing details', async () => {
    mockGetWorkspaceBillingProfile.mockResolvedValue({ ok: true, data: { profile: savedProfile } });

    render(
      <MemoryRouter>
        <WorkspaceBillingProfileSection workspaceId="ws-1" canManage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Inc')).toBeTruthy();
    });
    expect(screen.getByText('Billing address')).toBeTruthy();
    expect(screen.getByText(/123 Mall Road/)).toBeTruthy();
    expect(screen.getByText('TAX-12345')).toBeTruthy();
    expect(screen.getByText('Include PO number on invoices.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit billing details' })).toBeTruthy();
  });

  it('shows empty state and add button when profile is missing', async () => {
    mockGetWorkspaceBillingProfile.mockResolvedValue({ ok: true, data: { profile: null } });

    render(
      <MemoryRouter>
        <WorkspaceBillingProfileSection workspaceId="ws-1" canManage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No billing details saved yet.')).toBeTruthy();
    });
    expect(screen.getByText('{Company Name}')).toBeTruthy();
    expect(screen.getByText('{Address}')).toBeTruthy();
    expect(screen.getByText('{Tax ID}')).toBeTruthy();
    expect(screen.getByText('{Notes}')).toBeTruthy();
    expect(screen.getByText('Billing address')).toBeTruthy();
    expect(screen.getByText('Tax ID')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add billing details' })).toBeTruthy();
  });

  it('opens edit modal and saves profile', async () => {
    mockGetWorkspaceBillingProfile.mockResolvedValue({ ok: true, data: { profile: null } });
    mockPatchWorkspaceBillingProfile.mockResolvedValue({
      ok: true,
      data: { profile: savedProfile },
    });

    render(
      <MemoryRouter>
        <WorkspaceBillingProfileSection workspaceId="ws-1" canManage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add billing details' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add billing details' }));

    fireEvent.change(screen.getByLabelText(/Company \/ Name/i), {
      target: { value: 'Acme Inc' },
    });
    fireEvent.change(screen.getByLabelText(/^Address$/i), { target: { value: '123 Mall Road' } });
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Lahore' } });
    fireEvent.change(screen.getByLabelText(/ZIP \/ Postal code/i), { target: { value: '54000' } });
    fireEvent.change(screen.getByLabelText(/^Country$/i), { target: { value: 'PK' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save billing details' }));

    await waitFor(() => {
      expect(mockPatchWorkspaceBillingProfile).toHaveBeenCalledWith(
        'ws-1',
        expect.objectContaining({ country: 'PK' }),
      );
    });
  });
});
