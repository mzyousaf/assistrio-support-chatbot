import type { WorkspaceInviteStatus } from '../models/workspace-invite.constants';

export function normalizeWorkspacePersonEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

/** Customer-facing invite row status, or null when the invite should be hidden. */
export function getCustomerInviteRowStatus(invite: {
  status: WorkspaceInviteStatus | string;
  expiresAt: Date | string;
  now?: Date;
}): 'pending' | 'expired' | null {
  const status = String(invite.status ?? '').trim();
  if (status === 'cancelled' || status === 'accepted') return null;
  if (status === 'expired') return 'expired';
  if (status === 'pending') {
    const expires = invite.expiresAt instanceof Date ? invite.expiresAt : new Date(invite.expiresAt);
    const now = invite.now ?? new Date();
    if (!Number.isNaN(expires.getTime()) && expires.getTime() <= now.getTime()) return 'expired';
    return 'pending';
  }
  return null;
}

/**
 * Keeps pending + expired invites only, drops accepted/cancelled, and hides invites
 * whose email already belongs to an active workspace member. Dedupes by email (first wins).
 */
export function filterCustomerVisibleInvites<T extends { email: string; status: string; expiresAt: Date | string }>(
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
