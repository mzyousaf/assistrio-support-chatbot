import {
  isWorkspaceAdminRole,
  isWorkspaceManagerRole,
  isWorkspaceMemberOnlyRole,
  isWorkspaceOwnerRole,
  workspaceManagerRoleRank,
} from './workspace-membership-role.util';

describe('workspace-membership-role.util', () => {
  it('identifies owner, admin, and member roles', () => {
    expect(isWorkspaceOwnerRole('owner')).toBe(true);
    expect(isWorkspaceAdminRole('admin')).toBe(true);
    expect(isWorkspaceMemberOnlyRole('member')).toBe(true);
    expect(isWorkspaceOwnerRole('admin')).toBe(false);
  });

  it('treats owner and admin as managers', () => {
    expect(isWorkspaceManagerRole('owner')).toBe(true);
    expect(isWorkspaceManagerRole('admin')).toBe(true);
    expect(isWorkspaceManagerRole('member')).toBe(false);
  });

  it('ranks owner before admin before member', () => {
    expect(workspaceManagerRoleRank('owner')).toBeLessThan(workspaceManagerRoleRank('admin'));
    expect(workspaceManagerRoleRank('admin')).toBeLessThan(workspaceManagerRoleRank('member'));
  });
});
