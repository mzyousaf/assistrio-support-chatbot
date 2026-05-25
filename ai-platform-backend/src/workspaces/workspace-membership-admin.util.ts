import { ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import {
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MANAGER_ROLES,
  WORKSPACE_OWNER_ROLE,
  WorkspaceMembership,
} from '../models/workspace-membership.schema';
import { isWorkspaceManagerRole, isWorkspaceOwnerRole } from '../models/workspace-membership-role.util';

export async function countWorkspaceManagers(
  membershipModel: Model<WorkspaceMembership>,
  workspaceId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(workspaceId)) return 0;
  return membershipModel
    .countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      role: { $in: [...WORKSPACE_MANAGER_ROLES] },
    })
    .exec();
}

/** Counts memberships with role admin (excludes owner). Kept for backward-compatible call sites. */
export async function countWorkspaceAdmins(
  membershipModel: Model<WorkspaceMembership>,
  workspaceId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(workspaceId)) return 0;
  return membershipModel
    .countDocuments({ workspaceId: new Types.ObjectId(workspaceId), role: WORKSPACE_ADMIN_ROLE })
    .exec();
}

export async function countWorkspaceOwners(
  membershipModel: Model<WorkspaceMembership>,
  workspaceId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(workspaceId)) return 0;
  return membershipModel
    .countDocuments({ workspaceId: new Types.ObjectId(workspaceId), role: WORKSPACE_OWNER_ROLE })
    .exec();
}

async function findMembershipRole(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<string | null> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workspaceId)) return null;
  const row = await membershipModel
    .findOne({
      userId: new Types.ObjectId(userId),
      workspaceId: new Types.ObjectId(workspaceId),
    })
    .select('role')
    .lean();
  return row ? String((row as { role?: string }).role ?? '') : null;
}

export async function isWorkspaceManager(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const role = await findMembershipRole(membershipModel, userId, workspaceId);
  return role != null && isWorkspaceManagerRole(role);
}

export async function isWorkspaceOwner(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const role = await findMembershipRole(membershipModel, userId, workspaceId);
  return role != null && isWorkspaceOwnerRole(role);
}

/** True for workspace owner or admin (owner passes admin-capable checks). */
export async function isWorkspaceAdmin(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return isWorkspaceManager(membershipModel, userId, workspaceId);
}

/** Throws 403 when the user is not a workspace manager (owner or admin). */
export async function assertWorkspaceManager(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const ok = await isWorkspaceManager(membershipModel, userId, workspaceId);
  if (!ok) {
    throw new ForbiddenException({
      error: 'Workspace admin access required.',
      errorCode: 'workspace_access_denied',
    });
  }
}

/** Throws 403 when the user is not workspace owner. Reserved for future owner-only actions. */
export async function assertWorkspaceOwner(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const ok = await isWorkspaceOwner(membershipModel, userId, workspaceId);
  if (!ok) {
    throw new ForbiddenException({
      error: 'Workspace owner access required.',
      errorCode: 'workspace_owner_required',
    });
  }
}

/** Backward-compatible alias: owner and admin pass. */
export async function assertWorkspaceAdmin(
  membershipModel: Model<WorkspaceMembership>,
  userId: string,
  workspaceId: string,
): Promise<void> {
  await assertWorkspaceManager(membershipModel, userId, workspaceId);
}
