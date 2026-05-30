/** Workspace has more active members than the current plan seat limit (e.g. after downgrade). */
export function isWorkspaceOverMemberLimit(memberCount: number, memberLimit: number): boolean {
  if (!Number.isFinite(memberCount) || !Number.isFinite(memberLimit) || memberLimit < 0) {
    return false;
  }
  return memberCount > memberLimit;
}
