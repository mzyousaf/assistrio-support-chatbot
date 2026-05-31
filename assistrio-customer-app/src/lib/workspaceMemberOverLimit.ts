export const WORKSPACE_MEMBER_LIMIT_EXCEEDED_MESSAGE =
  'Your workspace has more members than your current plan allows. Remove members or upgrade to invite more teammates.';

export const WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_MESSAGE =
  'Your access to this workspace is inactive because the workspace is over its member limit.';

export const WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_ROW_MESSAGE =
  'This member was deactivated because the workspace is over its seat limit.';

export function isWorkspaceOverMemberLimit(activeMembers: number, memberLimit: number | null | undefined): boolean {
  if (memberLimit == null || !Number.isFinite(memberLimit) || memberLimit < 0) return false;
  return activeMembers > memberLimit;
}

export function countActiveWorkspaceMembers(
  members: Array<{ membershipStatus?: string | null }>,
): number {
  return members.filter((member) => member.membershipStatus !== 'inactive_over_limit').length;
}

export function isInactiveOverLimitMember(member: { membershipStatus?: string | null }): boolean {
  return member.membershipStatus === 'inactive_over_limit';
}

export function workspaceMemberSeatUsagePercent(seatsUsed: number, memberLimit: number | null | undefined): number {
  if (memberLimit == null || !Number.isFinite(memberLimit) || memberLimit <= 0) return 0;
  return Math.round((seatsUsed / memberLimit) * 100);
}
