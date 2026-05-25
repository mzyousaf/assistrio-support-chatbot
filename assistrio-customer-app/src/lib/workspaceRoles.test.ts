import { describe, expect, it } from 'vitest';
import {
  isWorkspaceAdminRole,
  isWorkspaceManagerRole,
  isWorkspaceMemberOnlyRole,
  isWorkspaceOwnerRole,
  workspaceRoleBadgeVariant,
  workspaceRoleLabel,
} from './workspaceRoles';

describe('workspaceRoles', () => {
  it('identifies manager roles', () => {
    expect(isWorkspaceOwnerRole('owner')).toBe(true);
    expect(isWorkspaceAdminRole('admin')).toBe(true);
    expect(isWorkspaceManagerRole('owner')).toBe(true);
    expect(isWorkspaceManagerRole('admin')).toBe(true);
    expect(isWorkspaceMemberOnlyRole('member')).toBe(true);
    expect(isWorkspaceManagerRole('member')).toBe(false);
  });

  it('returns human-readable labels', () => {
    expect(workspaceRoleLabel('owner')).toBe('Owner');
    expect(workspaceRoleLabel('admin')).toBe('Admin');
    expect(workspaceRoleLabel('member')).toBe('Member');
  });

  it('maps badge variants', () => {
    expect(workspaceRoleBadgeVariant('owner')).toBe('owner');
    expect(workspaceRoleBadgeVariant('admin')).toBe('admin');
    expect(workspaceRoleBadgeVariant('member')).toBe('member');
  });
});
