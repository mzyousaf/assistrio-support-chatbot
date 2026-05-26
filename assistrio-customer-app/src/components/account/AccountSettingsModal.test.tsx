import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe } from '@/api/types';
import { AccountSettingsModal } from './AccountSettingsModal';

const mockApplyCustomerSession = vi.fn();
const mockPatchProfile = vi.fn();
const mockPostAvatar = vi.fn();

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: mockCustomer,
    applyCustomerSession: mockApplyCustomerSession,
  }),
}));

vi.mock('@/api/customerApi', () => ({
  patchCustomerMeProfile: (...args: unknown[]) => mockPatchProfile(...args),
  postCustomerMeAvatar: (...args: unknown[]) => mockPostAvatar(...args),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn() },
}));

let mockCustomer: CustomerMe = {
  id: 'user-1',
  email: 'jane@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  firstName: 'Jane',
  lastName: 'Doe',
};

describe('AccountSettingsModal', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      Object.assign(globalThis.URL, {
        createObjectURL: vi.fn(() => 'blob:preview'),
        revokeObjectURL: vi.fn(),
      }),
    );
    mockCustomer = {
      id: 'user-1',
      email: 'jane@example.com',
      role: 'customer',
      activeWorkspaceId: 'ws-1',
      workspaceIds: ['ws-1'],
      firstName: 'Jane',
      lastName: 'Doe',
    };
    mockPatchProfile.mockResolvedValue({
      ok: true,
      data: {
        customer: {
          ...mockCustomer,
          firstName: 'Janet',
          lastName: 'Doe',
          profileLinks: {
            linkedinUrl: 'https://linkedin.com/in/janet',
            calendlyUrl: null,
            websiteUrl: null,
            otherUrl: null,
          },
        },
      },
    });
    mockPostAvatar.mockResolvedValue({
      ok: true,
      data: {
        customer: {
          ...mockCustomer,
          picture: 'https://cdn.example.com/avatar.png',
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders profile fields, website, and avatar upload trigger', () => {
    render(<AccountSettingsModal open onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Account settings' })).toBeTruthy();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Jane Doe');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('jane@example.com');
    expect(screen.getByLabelText('Website')).toBeTruthy();
    expect(screen.getByLabelText('LinkedIn URL')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Links' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change profile photo' })).toBeTruthy();
  });

  it('saves profile changes and updates session', async () => {
    const onClose = vi.fn();
    render(<AccountSettingsModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Janet Doe' } });
    fireEvent.change(screen.getByLabelText('LinkedIn URL'), {
      target: { value: 'https://linkedin.com/in/janet' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockPatchProfile).toHaveBeenCalledWith({
        name: 'Janet Doe',
        profileLinks: { linkedinUrl: 'https://linkedin.com/in/janet' },
      });
      expect(mockApplyCustomerSession).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('uploads avatar on file select', async () => {
    render(<AccountSettingsModal open onClose={() => {}} />);

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockPostAvatar).toHaveBeenCalled();
      expect(mockApplyCustomerSession).toHaveBeenCalled();
    });
  });
});
