import type { WorkspaceMemberRole } from '../models/workspace-membership.schema';
import { workspaceManagerRoleRank } from '../models/workspace-membership-role.util';

/** Membership row joined with workspace fields for session ordering. */
export type WorkspaceMembershipSessionRow = {
  workspaceId: string;
  role: WorkspaceMemberRole;
  workspaceCreatedAt: Date;
  workspaceName: string;
};

/** Owner before admin before member; then earliest workspace; then name. */
export function compareWorkspaceMembershipSessionRows(
  a: WorkspaceMembershipSessionRow,
  b: WorkspaceMembershipSessionRow,
): number {
  const roleDelta = workspaceManagerRoleRank(a.role) - workspaceManagerRoleRank(b.role);
  if (roleDelta !== 0) return roleDelta;

  const createdDelta = a.workspaceCreatedAt.getTime() - b.workspaceCreatedAt.getTime();
  if (createdDelta !== 0) return createdDelta;

  return a.workspaceName.localeCompare(b.workspaceName);
}

/** Deterministic fallback when user has no valid active workspace stored. */
export function pickFallbackActiveWorkspaceId(rows: WorkspaceMembershipSessionRow[]): string | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(compareWorkspaceMembershipSessionRows);
  return sorted[0]!.workspaceId;
}

/** Active workspace first, remaining rows in deterministic order. */
export function orderWorkspaceRowsForSession(
  rows: WorkspaceMembershipSessionRow[],
  activeWorkspaceId: string | null,
): WorkspaceMembershipSessionRow[] {
  const sorted = [...rows].sort(compareWorkspaceMembershipSessionRows);
  if (!activeWorkspaceId) return sorted;

  const activeIndex = sorted.findIndex((row) => row.workspaceId === activeWorkspaceId);
  if (activeIndex <= 0) return sorted;

  const active = sorted[activeIndex]!;
  const rest = sorted.filter((_, index) => index !== activeIndex);
  return [active, ...rest];
}
