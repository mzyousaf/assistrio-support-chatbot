import type { WorkspaceInviteSummary, WorkspaceMemberSummary, WorkspaceMembershipStatus } from '@/api/types';
import { formatWorkspaceMemberDate, formatWorkspaceMemberName } from './workspaceMembersMessages';

export function normalizeWorkspacePersonEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

export function getCustomerInviteRowStatus(invite: {
  status: string;
  expiresAt: string;
  now?: Date;
}): 'pending' | 'expired' | null {
  const status = String(invite.status ?? '').trim();
  if (status === 'cancelled' || status === 'accepted') return null;
  if (status === 'expired') return 'expired';
  if (status === 'pending') {
    const expires = new Date(invite.expiresAt);
    const now = invite.now ?? new Date();
    if (!Number.isNaN(expires.getTime()) && expires.getTime() <= now.getTime()) return 'expired';
    return 'pending';
  }
  return null;
}

export function filterCustomerVisibleInvites<T extends { email: string; status: string; expiresAt: string }>(
  invites: T[],
  memberEmails: string[],
  now: Date = new Date(),
): T[] {
  const memberEmailSet = new Set(memberEmails.map(normalizeWorkspacePersonEmail));
  const seenEmails = new Set<string>();
  const out: T[] = [];

  for (const invite of invites) {
    const email = normalizeWorkspacePersonEmail(invite.email);
    if (!email || memberEmailSet.has(email)) continue;
    if (getCustomerInviteRowStatus({ ...invite, now }) === null) continue;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    out.push(invite);
  }

  return out;
}

export type WorkspacePersonRow =
  | {
      kind: 'member';
      id: string;
      name: string;
      email: string;
      status: 'Active' | 'Inactive — over seat limit';
      role: WorkspaceMemberSummary['role'];
      dateLabel: string;
      botAccessSummary?: { viewable: number; previewable: number };
      member: WorkspaceMemberSummary;
    }
  | {
      kind: 'invite';
      id: string;
      name: string;
      email: string;
      status: 'Pending invite' | 'Expired';
      role: WorkspaceInviteSummary['role'];
      dateLabel: string;
      botAccessSummary?: { viewable: number; previewable: number };
      invite: WorkspaceInviteSummary;
    };

function memberRowStatus(status?: WorkspaceMembershipStatus | null): 'Active' | 'Inactive — over seat limit' {
  return status === 'inactive_over_limit' ? 'Inactive — over seat limit' : 'Active';
}

export function buildWorkspacePersonRows(
  members: WorkspaceMemberSummary[],
  invites: WorkspaceInviteSummary[],
  now: Date = new Date(),
): WorkspacePersonRow[] {
  const memberRows: WorkspacePersonRow[] = members.map((member) => ({
    kind: 'member',
    id: member.userId,
    name: formatWorkspaceMemberName(member),
    email: member.email,
    status: memberRowStatus(member.membershipStatus),
    role: member.role,
    dateLabel: formatWorkspaceMemberDate(member.joinedAt),
    botAccessSummary: member.botAccessSummary,
    member,
  }));

  const memberEmails = members.map((member) => member.email);
  const visibleInvites = filterCustomerVisibleInvites(invites, memberEmails, now);

  const inviteRows: WorkspacePersonRow[] = visibleInvites.map((invite) => {
    const rowStatus = getCustomerInviteRowStatus({ ...invite, now });
    return {
      kind: 'invite',
      id: invite.id,
      name: invite.email,
      email: invite.email,
      status: rowStatus === 'expired' ? ('Expired' as const) : ('Pending invite' as const),
      role: invite.role,
      dateLabel: formatWorkspaceMemberDate(invite.createdAt ?? invite.expiresAt),
      botAccessSummary: invite.botAccessSummary,
      invite,
    };
  });

  return [...memberRows, ...inviteRows];
}
