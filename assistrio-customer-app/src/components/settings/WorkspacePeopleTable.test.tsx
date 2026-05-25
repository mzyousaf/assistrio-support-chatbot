import { describe, expect, it } from 'vitest';
import type { WorkspaceInviteSummary, WorkspaceMemberSummary } from '@/api/types';
import { buildWorkspacePersonRows } from './WorkspacePeopleTable';

const members: WorkspaceMemberSummary[] = [
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
  {
    id: 'inv-cancelled',
    email: 'cancelled@test.com',
    role: 'member',
    status: 'cancelled',
    expiresAt: '2026-12-01T00:00:00.000Z',
    invitedByUserId: 'user-owner',
    acceptedByUserId: null,
    acceptedAt: null,
    cancelledAt: '2026-06-02T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
  },
];

describe('buildWorkspacePersonRows', () => {
  it('includes active members and pending invites only', () => {
    const rows = buildWorkspacePersonRows(members, invites);
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.kind === 'member' && row.email === 'member@test.com')).toBe(true);
    expect(rows.some((row) => row.kind === 'invite' && row.email === 'pending@test.com')).toBe(true);
    expect(rows.some((row) => row.email === 'expired@test.com')).toBe(false);
    expect(rows.some((row) => row.email === 'cancelled@test.com')).toBe(false);
  });
});
