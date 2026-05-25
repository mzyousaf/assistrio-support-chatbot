import {
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MANAGER_ROLES,
  WORKSPACE_MEMBER_ROLE,
  WORKSPACE_OWNER_ROLE,
  type WorkspaceMemberRole,
} from './workspace-membership.schema';

export function isWorkspaceOwnerRole(role: string): role is typeof WORKSPACE_OWNER_ROLE {
  return role === WORKSPACE_OWNER_ROLE;
}

export function isWorkspaceAdminRole(role: string): role is typeof WORKSPACE_ADMIN_ROLE {
  return role === WORKSPACE_ADMIN_ROLE;
}

export function isWorkspaceManagerRole(role: string): role is (typeof WORKSPACE_MANAGER_ROLES)[number] {
  return (WORKSPACE_MANAGER_ROLES as readonly string[]).includes(role);
}

export function isWorkspaceMemberOnlyRole(role: string): role is typeof WORKSPACE_MEMBER_ROLE {
  return role === WORKSPACE_MEMBER_ROLE;
}

export function workspaceManagerRoleRank(role: WorkspaceMemberRole): number {
  if (role === WORKSPACE_OWNER_ROLE) return 0;
  if (role === WORKSPACE_ADMIN_ROLE) return 1;
  return 2;
}
