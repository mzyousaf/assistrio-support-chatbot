import type { ApiResult } from '../api/types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidInviteEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);
}

export function formatWorkspaceMemberName(member: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const parts = [member.firstName?.trim(), member.lastName?.trim()].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return member.email.trim();
}

export function formatWorkspaceMemberDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isPendingWorkspaceInvite(invite: { status: string; expiresAt: string }): boolean {
  if (invite.status !== 'pending') return false;
  const expires = new Date(invite.expiresAt);
  return !Number.isNaN(expires.getTime()) && expires.getTime() > Date.now();
}

export function countWorkspaceSeatsUsed(
  memberCount: number,
  invites: Array<{ status: string; expiresAt: string }>,
): number {
  const pendingCount = invites.filter(isPendingWorkspaceInvite).length;
  return memberCount + pendingCount;
}

export function isWorkspaceMembersAccessDenied(result: ApiResult<unknown>): boolean {
  if (result.ok) return false;
  if (result.status === 403) return true;
  return result.errorCode === 'workspace_access_denied';
}

export function workspaceMembersErrorMessage(result: ApiResult<unknown>, fallback: string): string {
  if (result.ok) return fallback;
  const code = result.errorCode?.trim();
  switch (code) {
    case 'plan_limit_workspace_members':
      return 'This workspace has reached its member limit. Upgrade your plan to invite more people.';
    case 'workspace_invite_already_pending':
      return 'A pending invite already exists for this email.';
    case 'workspace_invite_member_exists':
      return 'This person is already a member of this workspace.';
    case 'workspace_access_denied':
      return 'Only workspace owners and admins can manage members.';
    case 'workspace_owner_protected':
      return 'Workspace owner cannot be removed.';
    case 'workspace_last_manager_required':
      return 'A workspace must have at least one owner or admin.';
    case 'workspace_last_admin_required':
      return 'A workspace must have at least one owner or admin.';
    case 'email_delivery_not_configured':
      return 'Invite email is not configured on the server. Contact support or try again later.';
    case 'email_delivery_failed':
      return 'Could not send the invite email. The invite was saved — try resending.';
    default:
      return result.error.trim() || fallback;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
