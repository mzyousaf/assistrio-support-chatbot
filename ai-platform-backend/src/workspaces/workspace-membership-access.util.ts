import { ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import {
  WORKSPACE_MEMBERSHIP_ACTIVE_STATUS_FILTER,
  WorkspaceMembership,
} from '../models/workspace-membership.schema';
import { normalizeMembershipStatus } from '../entitlements/workspace-member-over-limit-reconcile.util';

export const WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_CODE = 'workspace_member_inactive_over_limit' as const;

export const WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_MESSAGE =
  'Your access to this workspace is inactive because the workspace is over its member limit.';

export type WorkspaceMemberInactiveOverLimitPayload = {
  message: string;
  errorCode: typeof WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_CODE;
};

export function isWorkspaceMemberInactiveOverLimitPayload(
  x: unknown,
): x is WorkspaceMemberInactiveOverLimitPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as WorkspaceMemberInactiveOverLimitPayload).errorCode === WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_CODE
  );
}

export async function findWorkspaceMembershipAccessRow(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<{ status: ReturnType<typeof normalizeMembershipStatus> } | null> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workspaceId)) return null;
  const row = await membershipModel
    .findOne({
      userId: new Types.ObjectId(userId),
      workspaceId: new Types.ObjectId(workspaceId),
    })
    .select('status')
    .lean();
  if (!row) return null;
  return { status: normalizeMembershipStatus((row as { status?: string }).status) };
}

/** Throws 403 when membership exists but is inactive due to seat over-limit. */
export async function assertWorkspaceActiveMembership(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const row = await findWorkspaceMembershipAccessRow(membershipModel, userId, workspaceId);
  if (!row) {
    throw new ForbiddenException({
      error: 'Workspace access denied.',
      errorCode: 'workspace_access_denied',
    });
  }
  if (row.status === 'inactive_over_limit') {
    throw new ForbiddenException({
      message: WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_MESSAGE,
      errorCode: WORKSPACE_MEMBER_INACTIVE_OVER_LIMIT_CODE,
    });
  }
}

export function workspaceMembershipExistsFilter(
  userId: string,
  workspaceId: string,
): Record<string, unknown> {
  return {
    userId: new Types.ObjectId(userId),
    workspaceId: new Types.ObjectId(workspaceId),
    ...WORKSPACE_MEMBERSHIP_ACTIVE_STATUS_FILTER,
  };
}
