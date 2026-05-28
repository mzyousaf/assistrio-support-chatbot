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
  const fixedNow = new Date('2026-06-01T12:00:00.000Z');

  it('includes active members, pending invites, and expired invites', () => {
    const rows = buildWorkspacePersonRows(members, invites, fixedNow);
    expect(rows).toHaveLength(4);
    expect(rows.some((row) => row.kind === 'member' && row.email === 'member@test.com')).toBe(true);
    expect(rows.some((row) => row.kind === 'invite' && row.email === 'pending@test.com')).toBe(true);
    expect(rows.some((row) => row.kind === 'invite' && row.email === 'expired@test.com' && row.status === 'Expired')).toBe(true);
  });

  it('excludes cancelled invites and accepted duplicates for active members', () => {
    const rows = buildWorkspacePersonRows(
      members,
      [
        ...invites,
        {
          id: 'inv-cancelled',
          email: 'cancelled@test.com',
          role: 'member',
          status: 'cancelled',
          expiresAt: '2026-12-01T00:00:00.000Z',
          invitedByUserId: 'user-owner',
          acceptedByUserId: null,
          acceptedAt: null,
          cancelledAt: '2026-06-01T00:00:00.000Z',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'inv-accepted-dup',
          email: 'member@test.com',
          role: 'member',
          status: 'accepted',
          expiresAt: '2026-12-01T00:00:00.000Z',
          invitedByUserId: 'user-owner',
          acceptedByUserId: 'user-1',
          acceptedAt: '2026-06-01T00:00:00.000Z',
          cancelledAt: null,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      fixedNow,
    );
    expect(rows.some((row) => row.email === 'cancelled@test.com')).toBe(false);
    expect(rows.filter((row) => row.email === 'member@test.com')).toHaveLength(1);
  });
});

const defaultTableProps = {
  onRemoveMember: vi.fn(),
  onCancelInvite: vi.fn(),
  onResendInvite: vi.fn(),
  onRoleChange: vi.fn(),
  onEditAccess: vi.fn(),
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

  it('renders expired invite with send again action', () => {
    const rows = buildWorkspacePersonRows(members, invites, new Date('2026-06-01T12:00:00.000Z'));
    const onResend = vi.fn();
    render(
      <WorkspacePeopleTable
        rows={rows}
        canManageRoles={false}
        resendBusyId={null}
        {...defaultTableProps}
        onResendInvite={onResend}
      />,
    );

    expect(screen.getByText('Expired')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Send again to expired@test.com/i }));
    expect(onResend).toHaveBeenCalled();
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

  it('renders image avatar when avatarUrl is provided', () => {
    const rows = buildWorkspacePersonRows(
      [
        {
          ...members[1]!,
          displayName: 'Member User',
          avatarUrl: 'https://cdn.example.com/avatar.png',
        },
      ],
      [],
    );
    const { container } = render(
      <WorkspacePeopleTable rows={rows} canManageRoles={false} resendBusyId={null} {...defaultTableProps} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toContain('avatar.png');
  });
});
