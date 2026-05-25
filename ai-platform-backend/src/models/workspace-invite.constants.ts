/** Workspace invite lifecycle statuses. */
export const WORKSPACE_INVITE_STATUSES = ['pending', 'accepted', 'expired', 'cancelled'] as const;
export type WorkspaceInviteStatus = (typeof WORKSPACE_INVITE_STATUSES)[number];

/** Default invite link validity from creation. */
export const WORKSPACE_INVITE_DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const WORKSPACE_INVITE_ALREADY_PENDING_CODE = 'workspace_invite_already_pending' as const;

export const WORKSPACE_INVITE_ALREADY_PENDING_MESSAGE =
  'A pending invite already exists for this email in this workspace.';

export const WORKSPACE_INVITE_NOT_FOUND_CODE = 'workspace_invite_not_found' as const;
export const WORKSPACE_INVITE_EXPIRED_CODE = 'workspace_invite_expired' as const;
export const WORKSPACE_INVITE_CANCELLED_CODE = 'workspace_invite_cancelled' as const;
export const WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE = 'workspace_invite_already_accepted' as const;
export const WORKSPACE_INVITE_EMAIL_MISMATCH_CODE = 'workspace_invite_email_mismatch' as const;
export const WORKSPACE_INVITE_MEMBER_EXISTS_CODE = 'workspace_invite_member_exists' as const;

export const WORKSPACE_ACCESS_DENIED_CODE = 'workspace_access_denied' as const;
export const WORKSPACE_LAST_ADMIN_REQUIRED_CODE = 'workspace_last_admin_required' as const;
export const WORKSPACE_LAST_MANAGER_REQUIRED_CODE = 'workspace_last_manager_required' as const;
export const WORKSPACE_OWNER_PROTECTED_CODE = 'workspace_owner_protected' as const;

/** Roles allowed when inviting a user to a workspace (owner is never invitable). */
export const WORKSPACE_INVITE_ROLES = ['admin', 'member'] as const;
export type WorkspaceInviteRole = (typeof WORKSPACE_INVITE_ROLES)[number];

export function isWorkspaceInviteStatus(value: string): value is WorkspaceInviteStatus {
  return (WORKSPACE_INVITE_STATUSES as readonly string[]).includes(value);
}

export function workspaceInviteExpiresAtFromNow(
  now: Date = new Date(),
  ttlMs: number = WORKSPACE_INVITE_DEFAULT_TTL_MS,
): Date {
  return new Date(now.getTime() + ttlMs);
}
