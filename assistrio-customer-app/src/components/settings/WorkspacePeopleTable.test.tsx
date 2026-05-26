import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceInviteSummary, WorkspaceMemberSummary } from '@/api/types';
import {
  WorkspacePeopleTable,
  buildWorkspacePersonRows,
} from './WorkspacePeopleTable';

const members: WorkspaceMemberSummary[] = [
  {
    userId: 'user-owner',
    email: 'owner@test.com',
    firstName: 'Owner',
    lastName: 'User',
    picture: null,
    role: 'owner',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    userId: 'user-1',
    email: 'member@test.com',
    firstName: 'Member',
    lastName: 'User',
    picture: null,
    role: 'member',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
];

const invites: WorkspaceInviteSummary[] = [
  {
    id: 'inv-pending',
    email: 'pending@test.com',
    role: 'member',
    status: 'pending',
    expiresAt: '2026-12-01T00:00:00.000Z',
    invitedByUserId: 'user-owner',
    acceptedByUserId: null,
    acceptedAt: null,
    cancelledAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'inv-expired',
    email: 'expired@test.com',
    role: 'member',
    status: 'expired',
    expiresAt: '2025-01-01T00:00:00.000Z',
    invitedByUserId: 'user-owner',
    acceptedByUserId: null,
    acceptedAt: null,
    cancelledAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

describe('buildWorkspacePersonRows', () => {
  it('includes active members and pending invites only', () => {
    const rows = buildWorkspacePersonRows(members, invites);
    expect(rows).toHaveLength(3);
    expect(rows.some((row) => row.kind === 'member' && row.email === 'member@test.com')).toBe(true);
    expect(rows.some((row) => row.kind === 'invite' && row.email === 'pending@test.com')).toBe(true);
    expect(rows.some((row) => row.email === 'expired@test.com')).toBe(false);
  });
});

const defaultTableProps = {
  onRemoveMember: vi.fn(),
  onCancelInvite: vi.fn(),
  onResendInvite: vi.fn(),
  onRoleChange: vi.fn(),
};

describe('WorkspacePeopleTable', () => {
  afterEach(() => cleanup());

  it('renders status and role badges', () => {
    const rows = buildWorkspacePersonRows(members, invites);
    render(
      <WorkspacePeopleTable
        rows={rows}
        canManageRoles={false}
        resendBusyId={null}
        {...defaultTableProps}
        onRemoveMember={vi.fn()}
        onCancelInvite={vi.fn()}
        onResendInvite={vi.fn()}
        onRoleChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Pending invite')).toBeTruthy();
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getAllByText('Member').length).toBeGreaterThanOrEqual(1);
  });

  it('renders pending invite actions and omits owner remove action', () => {
    const rows = buildWorkspacePersonRows(members, invites);
    const onResend = vi.fn();
    const onCancel = vi.fn();
    const onRemove = vi.fn();

    render(
      <WorkspacePeopleTable
        rows={rows}
        canManageRoles={false}
        resendBusyId={null}
        {...defaultTableProps}
        onRemoveMember={onRemove}
        onCancelInvite={onCancel}
        onResendInvite={onResend}
        onRoleChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Remove Owner User/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Resend invite to pending@test.com/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancel invite for pending@test.com/i }));
    fireEvent.click(screen.getByRole('button', { name: /Remove Member User/i }));

    expect(onResend).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  it('shows invite hint when only the owner would be listed', () => {
    render(
      <WorkspacePeopleTable
        rows={[]}
        canManageRoles={false}
        resendBusyId={null}
        showInviteHint
        {...defaultTableProps}
      />,
    );

    expect(screen.getByText('Invite teammates to collaborate on this workspace.')).toBeTruthy();
  });
});
