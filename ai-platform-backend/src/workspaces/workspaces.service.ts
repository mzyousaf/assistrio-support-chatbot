import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceMembership, type WorkspaceMemberRole } from '../models';

function oidString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && v !== null && 'toString' in v) return String((v as { toString(): string }).toString());
  return String(v);
}

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(WorkspaceMembership.name) private readonly membershipModel: Model<WorkspaceMembership>,
  ) {}

  /**
   * Creates a workspace and makes the user its workspace admin (first membership).
   */
  async createWorkspaceWithAdminMember(userId: Types.ObjectId, name?: string): Promise<{ workspaceId: Types.ObjectId }> {
    const ws = await this.workspaceModel.create({
      name: (name?.trim() || 'My workspace').slice(0, 120),
      createdAt: new Date(),
    });
    const workspaceId = (ws as { _id: Types.ObjectId })._id;
    await this.membershipModel.create({
      workspaceId,
      userId,
      role: 'admin' as WorkspaceMemberRole,
    });
    return { workspaceId };
  }

  /**
   * If the user has no workspace membership, creates one workspace + admin membership (migration / legacy users).
   */
  async ensurePersonalWorkspaceForUser(userId: string): Promise<Types.ObjectId> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user id');
    }
    const uid = new Types.ObjectId(userId);
    const existing = await this.membershipModel.findOne({ userId: uid }).select('workspaceId').lean();
    if (existing && (existing as { workspaceId?: Types.ObjectId }).workspaceId) {
      return (existing as { workspaceId: Types.ObjectId }).workspaceId;
    }
    const { workspaceId } = await this.createWorkspaceWithAdminMember(uid);
    return workspaceId;
  }

  async getWorkspaceIdsForUser(userId: string): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const rows = await this.membershipModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('workspaceId')
      .lean();
    return (rows as { workspaceId: Types.ObjectId }[]).map((r) => r.workspaceId).filter(Boolean);
  }

  async isUserMemberOfWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workspaceId)) return false;
    const m = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .select('_id')
      .lean();
    return !!m;
  }

  /**
   * Access to showcase bot in the admin API or preview: superadmin, workspace member, or legacy owner.
   */
  async canUserAccessShowcaseBot(
    userId: string,
    platformRole: string,
    bot: Record<string, unknown>,
  ): Promise<boolean> {
    if (platformRole === 'superadmin') return true;
    const uid = userId.trim();
    if (!Types.ObjectId.isValid(uid)) return false;

    const ws = bot.workspaceId;
    if (ws != null && String(ws).length > 0) {
      return this.isUserMemberOfWorkspace(uid, oidString(ws));
    }

    const owner = oidString(bot.ownerUserId);
    const createdBy = oidString(bot.createdByUserId);
    return owner === uid || createdBy === uid;
  }

  /**
   * `/api/widget/preview/*` (signed-in user): only the bot owner/creator may preview, not other workspace members.
   * Superadmin may still preview any bot. Visitor preview uses {@link bot.ownerVisitorId} in the preview controller.
   */
  canUserPreviewShowcaseBotAsOwner(userId: string, platformRole: string, bot: Record<string, unknown>): boolean {
    if (platformRole === 'superadmin') return true;
    const uid = userId.trim();
    if (!Types.ObjectId.isValid(uid)) return false;
    const owner = oidString(bot.ownerUserId);
    const createdBy = oidString(bot.createdByUserId);
    if (owner && owner === uid) return true;
    if (createdBy && createdBy === uid) return true;
    return false;
  }
}
