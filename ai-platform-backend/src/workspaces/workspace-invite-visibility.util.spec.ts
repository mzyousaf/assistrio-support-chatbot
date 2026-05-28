import {
  filterCustomerVisibleInvites,
  getCustomerInviteRowStatus,
  normalizeWorkspacePersonEmail,
} from './workspace-invite-visibility.util';

describe('workspace-invite-visibility.util', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('normalizes invite emails', () => {
    expect(normalizeWorkspacePersonEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('returns null for cancelled and accepted invites', () => {
    expect(
      getCustomerInviteRowStatus({
        status: 'cancelled',
        expiresAt: '2026-12-01T00:00:00.000Z',
        now,
      }),
    ).toBeNull();
    expect(
      getCustomerInviteRowStatus({
        status: 'accepted',
        expiresAt: '2026-12-01T00:00:00.000Z',
        now,
      }),
    ).toBeNull();
  });

  it('treats time-expired pending invites as expired', () => {
    expect(
      getCustomerInviteRowStatus({
        status: 'pending',
        expiresAt: '2025-01-01T00:00:00.000Z',
        now,
      }),
    ).toBe('expired');
  });

  it('filters cancelled, accepted, and member-duplicate invites', () => {
    const invites = [
      { id: '1', email: 'active@test.com', status: 'accepted', expiresAt: '2026-12-01T00:00:00.000Z' },
      { id: '2', email: 'cancelled@test.com', status: 'cancelled', expiresAt: '2026-12-01T00:00:00.000Z' },
      { id: '3', email: 'pending@test.com', status: 'pending', expiresAt: '2026-12-01T00:00:00.000Z' },
      { id: '4', email: 'expired@test.com', status: 'expired', expiresAt: '2025-01-01T00:00:00.000Z' },
      { id: '5', email: 'member@test.com', status: 'pending', expiresAt: '2026-12-01T00:00:00.000Z' },
    ];

    const visible = filterCustomerVisibleInvites(invites, ['member@test.com'], now);
    expect(visible.map((row) => row.email)).toEqual(['pending@test.com', 'expired@test.com']);
  });
});
