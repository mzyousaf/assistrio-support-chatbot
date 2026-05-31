import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WORKSPACE_OWNER_ROLE,
  WorkspaceMembership,
} from '../models/workspace-membership.schema';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import {
  normalizeMembershipStatus,
  resolveDesiredMemberStatuses,
  type MemberSeatRecord,
} from './workspace-member-over-limit-reconcile.util';

export type WorkspaceMemberOverLimitReconcileResult = {
  activeKept: number;
  deactivated: number;
  reactivated: number;
};

@Injectable()
export class WorkspaceMemberOverLimitReconcileService {
  constructor(
    @InjectModel(WorkspaceMembership.name)
    private readonly membershipModel: Model<WorkspaceMembership>,
    @Inject(forwardRef(() => WorkspaceEntitlementsService))
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  async reconcileWorkspaceMembersAgainstLimit(
    workspaceId: string,
    options?: { now?: Date; memberLimit?: number },
  ): Promise<WorkspaceMemberOverLimitReconcileResult> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      return { activeKept: 0, deactivated: 0, reactivated: 0 };
    }

    const now = options?.now ?? new Date();
    const memberLimit =
      options?.memberLimit ??
      (
        await this.entitlementsService.resolveForWorkspace(workspaceId, now, {
          skipMemberReconcile: true,
        })
      ).memberLimit;

    const rows = await this.membershipModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .select('_id userId role status')
      .lean()
      .exec();

    if (!rows.length) {
      return { activeKept: 0, deactivated: 0, reactivated: 0 };
    }

    const records: MemberSeatRecord[] = (rows as {
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      role?: string;
      status?: string;
    }[]).map((row) => ({
      membershipId: String(row._id),
      userId: String(row.userId),
      role: String(row.role ?? 'member'),
      status: normalizeMembershipStatus(row.status),
      joinedAt: row._id?.getTimestamp?.() ?? null,
    }));

    const desired = resolveDesiredMemberStatuses(records, memberLimit);
    let activeKept = 0;
    let deactivated = 0;
    let reactivated = 0;

    for (const record of records) {
      const targetStatus = desired.get(record.membershipId) ?? 'active';
      if (record.status === targetStatus) {
        if (targetStatus === 'active') activeKept += 1;
        continue;
      }

      await this.membershipModel.updateOne(
        { _id: new Types.ObjectId(record.membershipId) },
        { $set: { status: targetStatus } },
      );

      if (targetStatus === 'inactive_over_limit') {
        deactivated += 1;
      } else {
        reactivated += 1;
        activeKept += 1;
      }
    }

    return { activeKept, deactivated, reactivated };
  }

  async reconcileIfNeeded(
    workspaceId: string,
    memberLimit: number,
    now: Date = new Date(),
  ): Promise<WorkspaceMemberOverLimitReconcileResult | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;

    const wsOid = new Types.ObjectId(workspaceId);
    const [activeCount, inactiveCount] = await Promise.all([
      this.membershipModel.countDocuments({ workspaceId: wsOid, status: { $ne: 'inactive_over_limit' } }).exec(),
      this.membershipModel.countDocuments({ workspaceId: wsOid, status: 'inactive_over_limit' }).exec(),
    ]);

    if (activeCount <= memberLimit && inactiveCount === 0) {
      return null;
    }

    return this.reconcileWorkspaceMembersAgainstLimit(workspaceId, { now, memberLimit });
  }

  /** Ensures owner rows remain active even if miscategorized. */
  async ensureOwnersActive(workspaceId: string): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) return;
    await this.membershipModel.updateMany(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        role: WORKSPACE_OWNER_ROLE,
        status: 'inactive_over_limit',
      },
      { $set: { status: 'active' } },
    );
  }
}
