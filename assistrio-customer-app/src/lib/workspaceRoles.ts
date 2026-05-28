import type { WorkspaceMemberRole, WorkspaceInviteRole } from '@/api/types';
import { cn } from '@/lib/utils';

export function isWorkspaceOwnerRole(role: string | null | undefined): role is 'owner' {
  return role === 'owner';
}

export function isWorkspaceAdminRole(role: string | null | undefined): role is 'admin' {
  return role === 'admin';
}

export function isWorkspaceMemberOnlyRole(role: string | null | undefined): role is 'member' {
  return role === 'member';
}

/** Owner and admin may manage workspace settings, bots, and members. */
export function isWorkspaceManagerRole(role: string | null | undefined): boolean {
  return isWorkspaceOwnerRole(role) || isWorkspaceAdminRole(role);
}

export function workspaceRoleLabel(role: string | null | undefined): string {
  if (isWorkspaceOwnerRole(role)) return 'Owner';
  if (isWorkspaceAdminRole(role)) return 'Admin';
  if (isWorkspaceMemberOnlyRole(role)) return 'Member';
  return 'Member';
}

export type WorkspaceRoleBadgeVariant = 'owner' | 'admin' | 'member';

export function workspaceRoleBadgeVariant(role: string | null | undefined): WorkspaceRoleBadgeVariant {
  if (isWorkspaceOwnerRole(role)) return 'owner';
  if (isWorkspaceAdminRole(role)) return 'admin';
  return 'member';
}

/** Tailwind classes for compact role badges (switcher, members table). */
export function workspaceRoleBadgeClassName(
  variant: WorkspaceRoleBadgeVariant,
  style: 'compact' | 'pill' = 'compact',
): string {
  if (style === 'pill') {
    switch (variant) {
      case 'owner':
        return 'bg-violet-50 text-violet-800 ring-1 ring-violet-100';
      case 'admin':
        return 'bg-teal-50 text-teal-800 ring-1 ring-teal-100';
      default:
        return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80';
    }
  }
  switch (variant) {
    case 'owner':
      return 'border-violet-100 bg-violet-50 text-violet-800';
    case 'admin':
      return 'border-teal-100 bg-teal-50 text-teal-800';
    default:
      return 'border-slate-200 bg-white text-slate-500';
  }
}

/** Pill badge styling for members table and role tag dropdown. */
export function workspaceRolePillClassName(role: string | null | undefined): string {
  const variant = workspaceRoleBadgeVariant(role);
  return cn(
    variant === 'owner' && 'bg-violet-50 text-violet-700',
    variant === 'admin' && 'bg-sky-50 text-sky-700',
    variant === 'member' && workspaceRoleBadgeClassName('member', 'pill'),
  );
}

export function isWorkspaceMembershipRole(value: string): value is WorkspaceMemberRole {
  return value === 'owner' || value === 'admin' || value === 'member';
}

export function isWorkspaceInviteRole(value: string): value is WorkspaceInviteRole {
  return value === 'admin' || value === 'member';
}
