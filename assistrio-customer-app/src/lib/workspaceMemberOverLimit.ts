export const WORKSPACE_MEMBER_LIMIT_EXCEEDED_MESSAGE =
  'Your workspace has more members than your current plan allows. Remove members or upgrade to invite more teammates.';

export function isWorkspaceOverMemberLimit(activeMembers: number, memberLimit: number | null | undefined): boolean {
  if (memberLimit == null || !Number.isFinite(memberLimit) || memberLimit < 0) return false;
  return activeMembers > memberLimit;
}

export function workspaceMemberSeatUsagePercent(seatsUsed: number, memberLimit: number | null | undefined): number {
  if (memberLimit == null || !Number.isFinite(memberLimit) || memberLimit <= 0) return 0;
  return Math.round((seatsUsed / memberLimit) * 100);
}
