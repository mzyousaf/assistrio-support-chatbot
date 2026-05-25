import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceInvite } from '../models/workspace-invite.schema';
import { WorkspaceMembership } from '../models/workspace-membership.schema';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

export const PLAN_LIMIT_WORKSPACE_MEMBERS_CODE = 'plan_limit_workspace_members' as const;

export const PLAN_LIMIT_WORKSPACE_MEMBERS_MESSAGE =
  'Your workspace has reached the member limit for the current plan.';

export type PlanLimitWorkspaceMembersUsage = {
  current: number;
  limit: number;
  planKey: string;
  planName: string;
};

export type PlanLimitWorkspaceMembersPayload = {
  message: string;
  errorCode: typeof PLAN_LIMIT_WORKSPACE_MEMBERS_CODE;
  usage: PlanLimitWorkspaceMembersUsage;
};

export type WorkspaceMemberUsage = PlanLimitWorkspaceMembersUsage & {
  memberCount: number;
  pendingInviteCount: number;
};

export function isPlanLimitWorkspaceMembersPayload(x: unknown): x is PlanLimitWorkspaceMembersPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as PlanLimitWorkspaceMembersPayload).errorCode === PLAN_LIMIT_WORKSPACE_MEMBERS_CODE
  );
}

export function isPlanLimitWorkspaceMembersHttpException(err: unknown): err is HttpException {
  if (!(err instanceof HttpException)) return false;
  return isPlanLimitWorkspaceMembersPayload(err.getResponse());
}

/** Pending invites that still consume a member slot (unexpired, not terminal). */
export function workspacePendingInviteCountFilter(
  workspaceId: Types.ObjectId,
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    workspaceId,
    status: 'pending',
    expiresAt: { $gt: now },
  };
}

@Injectable()
export class WorkspaceMemberLimitService {
  constructor(
    @InjectModel(WorkspaceMembership.name) private readonly membershipModel: Model<WorkspaceMembership>,
    @InjectModel(WorkspaceInvite.name) private readonly inviteModel: Model<WorkspaceInvite>,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  async countWorkspaceMembers(workspaceId: string): Promise<number> {
    if (!Types.ObjectId.isValid(workspaceId)) return 0;
    return this.membershipModel
      .countDocuments({ workspaceId: new Types.ObjectId(workspaceId) })
      .exec();
  }

  async countPendingUnexpiredInvites(workspaceId: string, now: Date = new Date()): Promise<number> {
    if (!Types.ObjectId.isValid(workspaceId)) return 0;
    return this.inviteModel
      .countDocuments(workspacePendingInviteCountFilter(new Types.ObjectId(workspaceId), now))
      .exec();
  }

  async getWorkspaceMemberUsage(workspaceId: string, now: Date = new Date()): Promise<WorkspaceMemberUsage> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const memberCount = await this.countWorkspaceMembers(workspaceId);
    const pendingInviteCount = await this.countPendingUnexpiredInvites(workspaceId, now);
    const current = memberCount + pendingInviteCount;

    return {
      current,
      limit: entitlements.memberLimit,
      planKey: entitlements.planKey,
      planName: entitlements.planName,
      memberCount,
      pendingInviteCount,
    };
  }

  async assertCanInviteMember(workspaceId: string, options?: { now?: Date }): Promise<void> {
    const usage = await this.getWorkspaceMemberUsage(workspaceId, options?.now);
    if (usage.current < usage.limit) return;

    const payload: PlanLimitWorkspaceMembersPayload = {
      message: PLAN_LIMIT_WORKSPACE_MEMBERS_MESSAGE,
      errorCode: PLAN_LIMIT_WORKSPACE_MEMBERS_CODE,
      usage: {
        current: usage.current,
        limit: usage.limit,
        planKey: usage.planKey,
        planName: usage.planName,
      },
    };
    throw new HttpException(payload, HttpStatus.FORBIDDEN);
  }
}
