import {
  compareWorkspaceMembershipSessionRows,
  orderWorkspaceRowsForSession,
  pickFallbackActiveWorkspaceId,
} from './workspace-session-order.util';

describe('workspace-session-order.util', () => {
  const ownerOld = {
    workspaceId: 'ws-owner-old',
    role: 'owner' as const,
    workspaceCreatedAt: new Date('2024-01-01T00:00:00.000Z'),
    workspaceName: 'Owned Alpha',
  };
  const ownerNew = {
    workspaceId: 'ws-owner-new',
    role: 'owner' as const,
    workspaceCreatedAt: new Date('2025-01-01T00:00:00.000Z'),
    workspaceName: 'Owned Beta',
  };
  const adminOld = {
    workspaceId: 'ws-admin-old',
    role: 'admin' as const,
    workspaceCreatedAt: new Date('2024-01-01T00:00:00.000Z'),
    workspaceName: 'Alpha',
  };
  const adminNew = {
    workspaceId: 'ws-admin-new',
    role: 'admin' as const,
    workspaceCreatedAt: new Date('2025-01-01T00:00:00.000Z'),
    workspaceName: 'Beta',
  };
  const memberWs = {
    workspaceId: 'ws-member',
    role: 'member' as const,
    workspaceCreatedAt: new Date('2023-01-01T00:00:00.000Z'),
    workspaceName: 'Team',
  };

  it('prefers owner over admin and member for fallback', () => {
    expect(pickFallbackActiveWorkspaceId([memberWs, adminNew, ownerNew])).toBe('ws-owner-new');
  });

  it('prefers admin over member when no owner workspace exists', () => {
    expect(pickFallbackActiveWorkspaceId([memberWs, adminNew])).toBe('ws-admin-new');
  });

  it('prefers earliest owner workspace when multiple owners exist', () => {
    expect(pickFallbackActiveWorkspaceId([ownerNew, ownerOld])).toBe('ws-owner-old');
  });

  it('prefers earliest admin workspace when multiple admins exist', () => {
    expect(pickFallbackActiveWorkspaceId([adminNew, adminOld])).toBe('ws-admin-old');
  });

  it('orders active workspace first in session list', () => {
    const ordered = orderWorkspaceRowsForSession([ownerOld, memberWs, adminNew], 'ws-member');
    expect(ordered.map((row) => row.workspaceId)).toEqual(['ws-member', 'ws-owner-old', 'ws-admin-new']);
  });

  it('sorts by name when role and createdAt tie', () => {
    const a = { ...adminOld, workspaceId: 'a', workspaceName: 'Zulu' };
    const b = { ...adminOld, workspaceId: 'b', workspaceName: 'Alpha' };
    expect(compareWorkspaceMembershipSessionRows(a, b)).toBeGreaterThan(0);
  });

  it('ranks owner before admin', () => {
    expect(compareWorkspaceMembershipSessionRows(ownerOld, adminOld)).toBeLessThan(0);
  });
});
