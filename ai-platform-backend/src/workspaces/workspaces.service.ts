import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, Workspace, WorkspaceMembership, type UserRole, type WorkspaceMemberRole } from '../models';
import { resolvePersonalWorkspaceDisplayName } from './workspace-personal-name.util';

function oidString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && v !== null && 'toString' in v) return String((v as { toString(): string }).toString());
  return String(v);
}

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(WorkspaceMembership.name) private readonly membershipModel: Model<WorkspaceMembership>,
  ) {}

  /**
   * Creates a workspace and makes the user its workspace admin (first membership).
   * Name is derived from platform role and optional profile fields ({@link resolvePersonalWorkspaceDisplayName}).
   */
  async createWorkspaceWithAdminMember(userId: Types.ObjectId): Promise<{ workspaceId: Types.ObjectId }> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new Error('User not found for workspace creation');
    }
    const u = user as { role?: UserRole; firstName?: string; lastName?: string };
    const displayName = resolvePersonalWorkspaceDisplayName({
      role: (u.role ?? 'customer') as UserRole,
      firstName: u.firstName,
      lastName: u.lastName,
    });
    const ws = await this.workspaceModel.create({
      name: displayName.slice(0, 120),
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

  /** Id + display name for each workspace the user belongs to (membership order). */
  async getWorkspacesSummaryForUser(userId: string): Promise<{ id: string; name: string }[]> {
    const ids = await this.getWorkspaceIdsForUser(userId);
    if (!ids.length) return [];
    const docs = await this.workspaceModel
      .find({ _id: { $in: ids } })
      .select('name')
      .lean();
    const byId = new Map(
      (docs as { _id: Types.ObjectId; name?: string }[]).map((d) => [
        String(d._id),
        String(d.name ?? '').trim() || 'Workspace',
      ]),
    );
    return ids.map((id) => ({
      id: String(id),
      name: byId.get(String(id)) ?? 'Workspace',
    }));
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
   * Access to workspace bot in the admin API: superadmin, workspace member, or owner.
   */
  async canUserAccessWorkspaceBot(
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

    const owner = oidString(bot.ownerId);
    const createdBy = oidString(bot.createdByUserId);
    return owner === uid || createdBy === uid;
  }

  /**
   * `/api/widget/preview/*`: only `bot.ownerId` may preview. Superadmin may preview any bot.
   */
  canUserPreviewBotAsOwner(userId: string, platformRole: string, bot: Record<string, unknown>): boolean {
    if (platformRole === 'superadmin') return true;
    const uid = userId.trim();
    if (!Types.ObjectId.isValid(uid)) return false;
    const owner = oidString(bot.ownerId);
    return !!owner && owner === uid;
  }
}
