import { WORKSPACE_OWNER_ROLE } from '../models/workspace-membership.schema';
import type { WorkspaceMembershipStatus } from '../models/workspace-membership.schema';

export type MemberSeatRecord = {
  membershipId: string;
  userId: string;
  role: string;
  status: WorkspaceMembershipStatus;
  joinedAt: Date | null;
};

export type MemberOverLimitReconcilePlan = Map<string, WorkspaceMembershipStatus>;

/** Owner always active; oldest non-owner memberships stay active up to seat limit. */
export function resolveDesiredMemberStatuses(
  members: MemberSeatRecord[],
  memberLimit: number,
): MemberOverLimitReconcilePlan {
  const plan = new Map<string, WorkspaceMembershipStatus>();

  if (!Number.isFinite(memberLimit) || memberLimit < 0) {
    for (const member of members) {
      plan.set(member.membershipId, 'active');
    }
    return plan;
  }

  const owners = members.filter((member) => member.role === WORKSPACE_OWNER_ROLE);
  const nonOwners = members.filter((member) => member.role !== WORKSPACE_OWNER_ROLE);

  nonOwners.sort(compareMemberSeatOrder);

  for (const owner of owners) {
    plan.set(owner.membershipId, 'active');
  }

  const slotsForNonOwners = Math.max(0, memberLimit - owners.length);
  nonOwners.forEach((member, index) => {
    plan.set(member.membershipId, index < slotsForNonOwners ? 'active' : 'inactive_over_limit');
  });

  return plan;
}

export function compareMemberSeatOrder(a: MemberSeatRecord, b: MemberSeatRecord): number {
  const ta = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
  const tb = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return a.membershipId.localeCompare(b.membershipId);
}

export function normalizeMembershipStatus(status: string | null | undefined): WorkspaceMembershipStatus {
  return status === 'inactive_over_limit' ? 'inactive_over_limit' : 'active';
}
