import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, Workspace, WorkspaceMembership, WorkspaceInvite, type UserRole, type WorkspaceMemberRole } from '../models';
import {
  DEFAULT_WORKSPACE_ONBOARDING_STATUS,
  DEFAULT_WORKSPACE_ONBOARDING_STEP,
  type WorkspaceOnboardingStatus,
  type WorkspaceOnboardingStep,
} from '../models/workspace-onboarding.constants';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import { resolvePersonalWorkspaceDisplayName } from './workspace-personal-name.util';
import { ASSISTRIO_PLATFORM_WORKSPACE_NAME } from '../platform-bots/platform-bot.util';
import {
  compareWorkspaceMembershipSessionRows,
  orderWorkspaceRowsForSession,
  pickFallbackActiveWorkspaceId,
  type WorkspaceMembershipSessionRow,
} from './workspace-session-order.util';
import {
  assertWorkspaceAdmin as assertWorkspaceAdminMembership,
  assertWorkspaceManager as assertWorkspaceManagerMembership,
  assertWorkspaceOwner as assertWorkspaceOwnerMembership,
  countWorkspaceManagers,
  countWorkspaceOwners,
  isWorkspaceAdmin as isWorkspaceAdminMembership,
  isWorkspaceManager as isWorkspaceManagerMembership,
} from './workspace-membership-admin.util';
import { isWorkspaceAdminRole, isWorkspaceManagerRole, isWorkspaceOwnerRole } from '../models/workspace-membership-role.util';
import { WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE, WORKSPACE_ADMIN_REQUIRED_FOR_BOT_MESSAGE } from './workspace-bot-manage.constants';
import {
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
} from './workspace-bot-member-visibility.util';
import {
  WORKSPACE_BOT_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_ACCESS_DENIED_MESSAGE,
  type BotAccessGrantInput,
  type BotAccessGrantRow,
} from './workspace-bot-access-grant.util';
import { WorkspaceBotAccessGrantService } from './workspace-bot-access-grant.service';
import {
  DEFAULT_WORKSPACE_DEFAULT_BOT_ACCESS_POLICY,
  normalizeWorkspaceDefaultBotAccessPolicy,
  type WorkspaceDefaultBotAccessPolicy,
} from './workspace-default-bot-access-policy.util';
import {
  WORKSPACE_DELETE_PAID_REQUIRED_CODE,
  WORKSPACE_DELETE_PAID_REQUIRED_MESSAGE,
  WORKSPACE_DELETE_PLATFORM_FORBIDDEN_CODE,
  WORKSPACE_DELETE_PLATFORM_FORBIDDEN_MESSAGE,
  WORKSPACE_DELETE_NOT_FOUND_CODE,
  WORKSPACE_NAME_MAX_LENGTH,
} from './workspace-delete.constants';
import {
  resolveWorkspaceMemberAvatarUrl,
  resolveWorkspaceMemberDisplayName,
} from './workspace-member-display.util';
import {
  WORKSPACE_LAST_MANAGER_REQUIRED_CODE,
  WORKSPACE_OWNER_PROTECTED_CODE,
  WORKSPACE_INVITE_ROLES,
  type WorkspaceInviteRole,
} from '../models/workspace-invite.constants';
import type { PlanKey } from '../entitlements/plan-catalog';
import type { WorkspaceSubscriptionStatus } from '../models/workspace-subscription.schema';
import type { WorkspaceMembershipStatus } from '../models/workspace-membership.schema';
import { WORKSPACE_MEMBERSHIP_ACTIVE_STATUS_FILTER } from '../models/workspace-membership.schema';
import {
  assertWorkspaceActiveMembership,
} from './workspace-membership-access.util';
import { normalizeMembershipStatus } from '../entitlements/workspace-member-over-limit-reconcile.util';

export type WorkspaceMemberListItem = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  picture: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceMemberRole;
  joinedAt: Date | null;
  membershipStatus: WorkspaceMembershipStatus;
};

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
    @InjectModel(WorkspaceInvite.name) private readonly inviteModel: Model<WorkspaceInvite>,
    private readonly workspaceSubscriptionsService: WorkspaceSubscriptionsService,
    private readonly botAccessGrantService: WorkspaceBotAccessGrantService,
  ) {}

  /**
   * Creates a customer workspace and makes the user its owner (first membership).
   * Name is derived from platform role and optional profile fields ({@link resolvePersonalWorkspaceDisplayName}).
   */
  async createWorkspaceWithOwnerMember(userId: Types.ObjectId): Promise<{ workspaceId: Types.ObjectId }> {
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
      role: 'owner' as WorkspaceMemberRole,
    });
    await this.workspaceSubscriptionsService.ensureFreeSubscriptionForWorkspace(workspaceId);
    return { workspaceId };
  }

  /** @deprecated Prefer {@link createWorkspaceWithOwnerMember}. Alias for customer workspace creation. */
  async createWorkspaceWithAdminMember(userId: Types.ObjectId): Promise<{ workspaceId: Types.ObjectId }> {
    return this.createWorkspaceWithOwnerMember(userId);
  }

  /**
   * If the user has no workspace membership, creates one workspace + admin membership (migration / legacy users).
   */
  /**
   * Shared workspace for Assistrio platform/admin bots. Creates the workspace if missing and ensures
   * the given superadmin is an admin member (not owner — platform workspace is not customer-owned).
   */
  async ensurePlatformWorkspace(superadminUserId: string): Promise<Types.ObjectId> {
    if (!Types.ObjectId.isValid(superadminUserId)) {
      throw new Error('Invalid user id');
    }
    const uid = new Types.ObjectId(superadminUserId);
    const existingWs = await this.workspaceModel
      .findOne({ name: ASSISTRIO_PLATFORM_WORKSPACE_NAME })
      .select('_id')
      .lean();
    let workspaceId: Types.ObjectId;
    if (existingWs && (existingWs as { _id?: Types.ObjectId })._id) {
      workspaceId = (existingWs as { _id: Types.ObjectId })._id;
    } else {
      const ws = await this.workspaceModel.create({
        name: ASSISTRIO_PLATFORM_WORKSPACE_NAME.slice(0, 120),
        createdAt: new Date(),
      });
      workspaceId = (ws as { _id: Types.ObjectId })._id;
    }
    await this.workspaceSubscriptionsService.ensureFreeSubscriptionForWorkspace(workspaceId);
    const membership = await this.membershipModel
      .findOne({ workspaceId, userId: uid })
      .select('_id')
      .lean();
    if (!membership) {
      await this.membershipModel.create({
        workspaceId,
        userId: uid,
        role: 'admin' as WorkspaceMemberRole,
      });
    }
    return workspaceId;
  }

  async ensurePersonalWorkspaceForUser(userId: string): Promise<Types.ObjectId> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user id');
    }
    const uid = new Types.ObjectId(userId);
    const existing = await this.membershipModel.findOne({ userId: uid }).select('workspaceId').lean();
    if (existing && (existing as { workspaceId?: Types.ObjectId }).workspaceId) {
      const workspaceId = (existing as { workspaceId: Types.ObjectId }).workspaceId;
      await this.workspaceSubscriptionsService.ensureFreeSubscriptionForWorkspace(workspaceId);
      return workspaceId;
    }
    const { workspaceId } = await this.createWorkspaceWithAdminMember(uid);
    await this.persistActiveWorkspaceId(userId, String(workspaceId));
    return workspaceId;
  }

  /** Sets active workspace when user is an active member; throws 403 otherwise. */
  async activateWorkspaceForUser(userId: string, workspaceId: string): Promise<void> {
    await assertWorkspaceActiveMembership(this.membershipModel, userId, workspaceId);
    await this.persistActiveWorkspaceId(userId, workspaceId);
  }

  /**
   * Resolves the user's active workspace id.
   * Uses stored `activeWorkspaceId` when still a member; otherwise picks a deterministic fallback
   * (owner before admin before member, then earliest workspace `createdAt`, then name) and persists it.
   */
  async resolveActiveWorkspaceForUser(userId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(userId)) return null;

    const rows = await this.loadMembershipSessionRows(userId);
    if (rows.length === 0) return null;

    const user = await this.userModel.findById(userId).select('activeWorkspaceId').lean();
    const storedRaw = (user as { activeWorkspaceId?: Types.ObjectId } | null)?.activeWorkspaceId;
    const stored = storedRaw != null && Types.ObjectId.isValid(String(storedRaw)) ? String(storedRaw) : null;

    if (stored && rows.some((row) => row.workspaceId === stored)) {
      return stored;
    }

    const fallback = pickFallbackActiveWorkspaceId(rows);
    if (fallback) {
      await this.persistActiveWorkspaceId(userId, fallback);
    }
    return fallback;
  }

  async getWorkspaceIdsForUser(userId: string): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const rows = await this.loadMembershipSessionRows(userId);
    return [...rows]
      .sort(compareWorkspaceMembershipSessionRows)
      .map((row) => new Types.ObjectId(row.workspaceId));
  }

  /** Workspace summaries in session order (active first, then deterministic fallback sort). */
  async getWorkspacesSummaryForUser(
    userId: string,
    activeWorkspaceId?: string | null,
  ): Promise<
    Array<{
      id: string;
      name: string;
      role: WorkspaceMemberRole;
      onboardingStatus: WorkspaceOnboardingStatus;
      onboardingCurrentStep: WorkspaceOnboardingStep;
      onboardingCreatedBotId: string | null;
    }>
  > {
    const rows = await this.loadMembershipSessionRows(userId);
    if (!rows.length) return [];

    const ordered = orderWorkspaceRowsForSession(rows, activeWorkspaceId ?? null);
    const ids = ordered.map((row) => new Types.ObjectId(row.workspaceId));
    const docs = await this.workspaceModel
      .find({ _id: { $in: ids }, deletedAt: { $exists: false } })
      .select('name onboardingStatus onboardingCurrentStep onboardingCreatedBotId deletedAt')
      .lean();
    const byId = new Map(
      (docs as {
        _id: Types.ObjectId;
        name?: string;
        onboardingStatus?: WorkspaceOnboardingStatus;
        onboardingCurrentStep?: WorkspaceOnboardingStep;
        onboardingCreatedBotId?: Types.ObjectId;
      }[]).map((d) => [
        String(d._id),
        {
          name: String(d.name ?? '').trim() || 'Workspace',
          onboardingStatus: d.onboardingStatus ?? DEFAULT_WORKSPACE_ONBOARDING_STATUS,
          onboardingCurrentStep: d.onboardingCurrentStep ?? DEFAULT_WORKSPACE_ONBOARDING_STEP,
          onboardingCreatedBotId:
            d.onboardingCreatedBotId != null && Types.ObjectId.isValid(String(d.onboardingCreatedBotId))
              ? String(d.onboardingCreatedBotId)
              : null,
        },
      ]),
    );

    return ordered.map((row) => {
      const ws = byId.get(row.workspaceId);
      return {
        id: row.workspaceId,
        name: ws?.name ?? row.workspaceName,
        role: row.role,
        onboardingStatus: ws?.onboardingStatus ?? DEFAULT_WORKSPACE_ONBOARDING_STATUS,
        onboardingCurrentStep: ws?.onboardingCurrentStep ?? DEFAULT_WORKSPACE_ONBOARDING_STEP,
        onboardingCreatedBotId: ws?.onboardingCreatedBotId ?? null,
      };
    });
  }

  private async persistActiveWorkspaceId(userId: string, workspaceId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workspaceId)) return;
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $set: { activeWorkspaceId: new Types.ObjectId(workspaceId) } },
    );
  }

  private async loadMembershipSessionRows(userId: string): Promise<WorkspaceMembershipSessionRow[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const uid = new Types.ObjectId(userId);
    const memberships = await this.membershipModel
      .find({ userId: uid, ...WORKSPACE_MEMBERSHIP_ACTIVE_STATUS_FILTER })
      .select('workspaceId role')
      .lean();
    if (!memberships.length) return [];

    const workspaceIds = (memberships as { workspaceId: Types.ObjectId }[]).map((row) => row.workspaceId);
    const workspaces = await this.workspaceModel
      .find({ _id: { $in: workspaceIds }, deletedAt: { $exists: false } })
      .select('name createdAt deletedAt')
      .lean();

    const workspaceById = new Map(
      (workspaces as { _id: Types.ObjectId; name?: string; createdAt?: Date }[]).map((ws) => [
        String(ws._id),
        {
          name: String(ws.name ?? '').trim() || 'Workspace',
          createdAt: ws.createdAt instanceof Date ? ws.createdAt : new Date(0),
        },
      ]),
    );

    return (memberships as { workspaceId: Types.ObjectId; role: WorkspaceMemberRole }[]).map((membership) => {
      const id = String(membership.workspaceId);
      const workspace = workspaceById.get(id);
      return {
        workspaceId: id,
        role: membership.role ?? 'member',
        workspaceCreatedAt: workspace?.createdAt ?? new Date(0),
        workspaceName: workspace?.name ?? 'Workspace',
      };
    }).filter((row) => workspaceById.has(row.workspaceId));
  }

  /** Lightweight workspace label for list responses. */
  async getWorkspaceDisplayName(workspaceId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    const ws = await this.workspaceModel.findById(workspaceId).select('name deletedAt').lean();
    if (!ws || (ws as { deletedAt?: Date }).deletedAt) return null;
    return String((ws as { name?: string }).name ?? '').trim() || 'Workspace';
  }

  async isUserMemberOfWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workspaceId)) return false;
    const ws = await this.workspaceModel.findById(workspaceId).select('deletedAt').lean();
    if (!ws || (ws as { deletedAt?: Date }).deletedAt) return false;
    const m = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        workspaceId: new Types.ObjectId(workspaceId),
        ...WORKSPACE_MEMBERSHIP_ACTIVE_STATUS_FILTER,
      })
      .select('_id')
      .lean();
    return !!m;
  }

  async assertWorkspaceAdmin(userId: string, workspaceId: string): Promise<void> {
    await assertWorkspaceAdminMembership(this.membershipModel, userId, workspaceId);
  }

  async assertWorkspaceManager(userId: string, workspaceId: string): Promise<void> {
    await assertWorkspaceManagerMembership(this.membershipModel, userId, workspaceId);
  }

  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberListItem[]> {
    if (!Types.ObjectId.isValid(workspaceId)) return [];
    const wsOid = new Types.ObjectId(workspaceId);
    const memberships = await this.membershipModel.find({ workspaceId: wsOid }).lean();
    if (!memberships.length) return [];

    const userIds = (memberships as { userId: Types.ObjectId }[]).map((row) => row.userId);
    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('email firstName lastName picture displayNameOverride pictureOverride')
      .lean();

    const userById = new Map(
      (users as {
        _id: Types.ObjectId;
        email?: string;
        firstName?: string;
        lastName?: string;
        picture?: string;
        displayNameOverride?: string | null;
        pictureOverride?: string | null;
      }[]).map((user) => [String(user._id), user]),
    );

    return (memberships as {
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      role: WorkspaceMemberRole;
      status?: string;
    }[])
      .map((membership) => {
        const user = userById.get(String(membership.userId));
        const profile = {
          email: String(user?.email ?? ''),
          firstName: user?.firstName ?? null,
          lastName: user?.lastName ?? null,
          displayNameOverride: user?.displayNameOverride ?? null,
          picture: user?.picture ?? null,
          pictureOverride: user?.pictureOverride ?? null,
        };
        return {
          userId: String(membership.userId),
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          picture: profile.picture,
          displayName: resolveWorkspaceMemberDisplayName(profile),
          avatarUrl: resolveWorkspaceMemberAvatarUrl(profile),
          role: membership.role ?? 'member',
          joinedAt: membership._id?.getTimestamp?.() ?? null,
          membershipStatus: normalizeMembershipStatus(membership.status),
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  async removeWorkspaceMember(
    workspaceId: string,
    targetUserId: string,
    actingUserId: string,
  ): Promise<void> {
    await assertWorkspaceManagerMembership(this.membershipModel, actingUserId, workspaceId);

    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(targetUserId)) {
      throw new ForbiddenException({ error: 'Workspace access denied.', errorCode: 'workspace_access_denied' });
    }

    const wsOid = new Types.ObjectId(workspaceId);
    const targetOid = new Types.ObjectId(targetUserId);
    const targetMembership = await this.membershipModel
      .findOne({ workspaceId: wsOid, userId: targetOid })
      .select('role')
      .lean();

    if (!targetMembership) {
      throw new ForbiddenException({ error: 'Workspace access denied.', errorCode: 'workspace_access_denied' });
    }

    const targetRole = (targetMembership as { role?: WorkspaceMemberRole }).role ?? 'member';

    if (isWorkspaceOwnerRole(targetRole)) {
      throw new ForbiddenException({
        message: 'The workspace owner cannot be removed.',
        errorCode: WORKSPACE_OWNER_PROTECTED_CODE,
      });
    }

    if (isWorkspaceManagerRole(targetRole)) {
      const ownerCount = await countWorkspaceOwners(this.membershipModel, workspaceId);
      if (ownerCount > 0) {
        // Owner exists — removing an admin is allowed (owner remains).
      } else {
        const managerCount = await countWorkspaceManagers(this.membershipModel, workspaceId);
        if (managerCount <= 1) {
          throw new ForbiddenException({
            message: 'Cannot remove the last workspace manager.',
            errorCode: WORKSPACE_LAST_MANAGER_REQUIRED_CODE,
          });
        }
      }
    }

    await this.membershipModel.deleteOne({ workspaceId: wsOid, userId: targetOid });
    await this.clearActiveWorkspaceIfMatches(targetUserId, workspaceId);
  }

  /** Clears active workspace when it matches a workspace the user was removed from. */
  async clearActiveWorkspaceIfMatches(userId: string, workspaceId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workspaceId)) return;
    const user = await this.userModel.findById(userId).select('activeWorkspaceId').lean();
    const active = (user as { activeWorkspaceId?: Types.ObjectId } | null)?.activeWorkspaceId;
    if (active != null && String(active) === workspaceId) {
      await this.userModel.updateOne({ _id: new Types.ObjectId(userId) }, { $unset: { activeWorkspaceId: '' } });
    }
  }

  async isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
    return isWorkspaceAdminMembership(this.membershipModel, userId, workspaceId);
  }

  async isWorkspaceManager(userId: string, workspaceId: string): Promise<boolean> {
    return isWorkspaceManagerMembership(this.membershipModel, userId, workspaceId);
  }

  async getUserWorkspaceMemberRole(userId: string, workspaceId: string): Promise<WorkspaceMemberRole | null> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workspaceId)) return null;
    const row = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .select('role')
      .lean();
    const role = (row as { role?: WorkspaceMemberRole } | null)?.role;
    return role ?? null;
  }

  async assertWorkspaceOwner(userId: string, workspaceId: string): Promise<void> {
    await assertWorkspaceOwnerMembership(this.membershipModel, userId, workspaceId);
  }

  async filterWorkspaceBotsForUser(
    userId: string,
    workspaceId: string,
    bots: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const memberRole = await this.getUserWorkspaceMemberRole(userId, workspaceId);
    return this.botAccessGrantService.filterBotsForUser(userId, memberRole, bots);
  }

  async listBotAccessGrantRows(workspaceId: string, botId: string): Promise<BotAccessGrantRow[]> {
    return this.botAccessGrantService.listGrantRowsForBot({ workspaceId, botId });
  }

  async buildBotViewAccessPreviewByBotIds(
    workspaceId: string,
    botIds: string[],
  ): Promise<Record<string, import('./workspace-bot-access-grant.util').BotViewAccessPreviewMember[]>> {
    return this.botAccessGrantService.buildViewAccessPreviewByBotIds(workspaceId, botIds);
  }

  async upsertBotAccessGrants(params: {
    workspaceId: string;
    botId: string;
    createdByUserId: string;
    grants: BotAccessGrantInput[];
  }): Promise<BotAccessGrantRow[]> {
    return this.botAccessGrantService.upsertGrantsForBot(params);
  }

  async summarizeMemberBotAccess(
    workspaceId: string,
    userId: string,
  ): Promise<{ viewable: number; previewable: number }> {
    return this.botAccessGrantService.summarizeUserBotAccess(workspaceId, userId);
  }

  async summarizeInviteBotAccess(
    workspaceId: string,
    inviteId: string,
  ): Promise<{ viewable: number; previewable: number }> {
    return this.botAccessGrantService.summarizeInviteBotAccess(workspaceId, inviteId);
  }

  async updateWorkspaceMemberRole(
    workspaceId: string,
    targetUserId: string,
    role: WorkspaceInviteRole,
    actingUserId: string,
  ): Promise<void> {
    await assertWorkspaceOwnerMembership(this.membershipModel, actingUserId, workspaceId);
    if (!WORKSPACE_INVITE_ROLES.includes(role)) {
      throw new ForbiddenException({ message: 'Invalid role.', errorCode: 'workspace_access_denied' });
    }
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(targetUserId)) {
      throw new ForbiddenException({ error: 'Workspace access denied.', errorCode: 'workspace_access_denied' });
    }
    const targetMembership = await this.membershipModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), userId: new Types.ObjectId(targetUserId) })
      .select('role')
      .lean();
    if (!targetMembership) {
      throw new ForbiddenException({ error: 'Workspace access denied.', errorCode: 'workspace_access_denied' });
    }
    const currentRole = (targetMembership as { role?: WorkspaceMemberRole }).role ?? 'member';
    if (isWorkspaceOwnerRole(currentRole)) {
      throw new ForbiddenException({
        message: 'The workspace owner role cannot be changed.',
        errorCode: WORKSPACE_OWNER_PROTECTED_CODE,
      });
    }
    if (isWorkspaceManagerRole(currentRole) && role === 'member') {
      const ownerCount = await countWorkspaceOwners(this.membershipModel, workspaceId);
      if (ownerCount === 0) {
        const managerCount = await countWorkspaceManagers(this.membershipModel, workspaceId);
        if (managerCount <= 1) {
          throw new ForbiddenException({
            message: 'Cannot change the last workspace manager to member.',
            errorCode: WORKSPACE_LAST_MANAGER_REQUIRED_CODE,
          });
        }
      }
    }
    await this.membershipModel.updateOne(
      { workspaceId: new Types.ObjectId(workspaceId), userId: new Types.ObjectId(targetUserId) },
      { $set: { role } },
    );
  }

  /**
   * Whether the user may mutate a workspace bot (create/edit/delete/publish/KB writes).
   * Owner role: always. Admin: only when canView grant. Member: never.
   */
  async canUserManageWorkspaceBot(
    userId: string,
    platformRole: string,
    bot: Record<string, unknown>,
  ): Promise<boolean> {
    if (platformRole === 'superadmin') return true;
    const uid = userId.trim();
    if (!Types.ObjectId.isValid(uid)) return false;

    const ws = bot.workspaceId;
    if (ws == null || String(ws).length === 0) {
      const owner = oidString(bot.ownerId);
      const createdBy = oidString(bot.createdByUserId);
      return owner === uid || createdBy === uid;
    }

    const wsId = oidString(ws);
    const memberRole = await this.getUserWorkspaceMemberRole(uid, wsId);
    if (memberRole != null && isWorkspaceOwnerRole(memberRole)) return true;
    if (memberRole == null || !isWorkspaceAdminRole(memberRole)) return false;
    return this.botAccessGrantService.userCanViewBot(uid, memberRole, bot);
  }

  /** Throws 403 when the user may view but not manage the bot. */
  async assertCanManageWorkspaceBot(
    userId: string,
    platformRole: string,
    bot: Record<string, unknown>,
  ): Promise<void> {
    const ok = await this.canUserManageWorkspaceBot(userId, platformRole, bot);
    if (!ok) {
      throw new ForbiddenException({
        message: WORKSPACE_ADMIN_REQUIRED_FOR_BOT_MESSAGE,
        error: WORKSPACE_ADMIN_REQUIRED_FOR_BOT_MESSAGE,
        errorCode: WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE,
      });
    }
  }

  /**
   * Access to workspace bot detail, analytics, knowledge read.
   * Workspace owner: all bots. Admin/member: per-person canView grant (no legacy fallback for workspace bots).
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
      const wsId = oidString(ws);
      if (!(await this.isUserMemberOfWorkspace(uid, wsId))) return false;
      const memberRole = await this.getUserWorkspaceMemberRole(uid, wsId);
      return this.botAccessGrantService.userCanViewBot(uid, memberRole, bot);
    }

    const owner = oidString(bot.ownerId);
    const createdBy = oidString(bot.createdByUserId);
    return owner === uid || createdBy === uid;
  }

  /** Playground/widget preview: workspace owner always; others need canPreview grant. */
  async canUserPreviewWorkspaceBot(
    userId: string,
    platformRole: string,
    bot: Record<string, unknown>,
  ): Promise<boolean> {
    if (platformRole === 'superadmin') return true;
    const uid = userId.trim();
    if (!Types.ObjectId.isValid(uid)) return false;

    const ws = bot.workspaceId;
    if (ws != null && String(ws).length > 0) {
      const wsId = oidString(ws);
      if (!(await this.isUserMemberOfWorkspace(uid, wsId))) return false;
      const memberRole = await this.getUserWorkspaceMemberRole(uid, wsId);
      return this.botAccessGrantService.userCanPreviewBot(uid, memberRole, bot);
    }

    return this.canUserPreviewBotAsOwner(userId, platformRole, bot);
  }

  async assertCanPreviewWorkspaceBot(
    userId: string,
    platformRole: string,
    bot: Record<string, unknown>,
  ): Promise<void> {
    const ok = await this.canUserPreviewWorkspaceBot(userId, platformRole, bot);
    if (!ok) {
      throw new ForbiddenException({
        message: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
        error: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
        errorCode: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
      });
    }
  }

  async assertCanAccessWorkspaceBot(
    userId: string,
    platformRole: string,
    bot: Record<string, unknown>,
  ): Promise<void> {
    const ok = await this.canUserAccessWorkspaceBot(userId, platformRole, bot);
    if (!ok) {
      throw new ForbiddenException({
        message: WORKSPACE_BOT_ACCESS_DENIED_MESSAGE,
        error: WORKSPACE_BOT_ACCESS_DENIED_MESSAGE,
        errorCode: WORKSPACE_BOT_ACCESS_DENIED_CODE,
      });
    }
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

  async getWorkspaceSettings(workspaceId: string): Promise<{ defaultBotAccessPolicy: WorkspaceDefaultBotAccessPolicy }> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      return { defaultBotAccessPolicy: { ...DEFAULT_WORKSPACE_DEFAULT_BOT_ACCESS_POLICY } };
    }
    const ws = await this.workspaceModel.findById(workspaceId).select('defaultBotAccessPolicy').lean();
    if (!ws) {
      return { defaultBotAccessPolicy: { ...DEFAULT_WORKSPACE_DEFAULT_BOT_ACCESS_POLICY } };
    }
    return {
      defaultBotAccessPolicy: normalizeWorkspaceDefaultBotAccessPolicy(
        (ws as { defaultBotAccessPolicy?: Partial<WorkspaceDefaultBotAccessPolicy> }).defaultBotAccessPolicy,
      ),
    };
  }

  async updateWorkspaceDefaultBotAccessPolicy(
    workspaceId: string,
    actingUserId: string,
    policy: WorkspaceDefaultBotAccessPolicy,
  ): Promise<{ defaultBotAccessPolicy: WorkspaceDefaultBotAccessPolicy }> {
    await assertWorkspaceOwnerMembership(this.membershipModel, actingUserId, workspaceId);
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new ForbiddenException({ error: 'Workspace access denied.', errorCode: 'workspace_access_denied' });
    }
    const normalized = normalizeWorkspaceDefaultBotAccessPolicy(policy);
    await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId) },
      { $set: { defaultBotAccessPolicy: normalized } },
    );
    return { defaultBotAccessPolicy: normalized };
  }

  async applyDefaultBotAccessGrantsOnBotCreate(params: {
    workspaceId: string;
    botId: string;
    createdByUserId: string;
  }): Promise<void> {
    if (!Types.ObjectId.isValid(params.workspaceId) || !Types.ObjectId.isValid(params.botId)) return;
    const settings = await this.getWorkspaceSettings(params.workspaceId);
    const policy = settings.defaultBotAccessPolicy;
    if (!policy.grantViewToWorkspacePeopleOnCreate && !policy.grantPreviewToWorkspacePeopleOnCreate) {
      return;
    }
    await this.botAccessGrantService.applyDefaultAccessGrantsForNewBot({
      ...params,
      policy,
    });
  }

  async updateWorkspaceName(
    workspaceId: string,
    actingUserId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    await assertWorkspaceManagerMembership(this.membershipModel, actingUserId, workspaceId);
    const trimmed = String(name ?? '').trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      throw new BadRequestException({ message: 'Workspace name cannot be empty.' });
    }
    if (trimmed.length > WORKSPACE_NAME_MAX_LENGTH) {
      throw new BadRequestException({ message: 'Workspace name is too long.' });
    }
    const ws = await this.workspaceModel.findById(workspaceId).select('name deletedAt').lean();
    if (!ws || (ws as { deletedAt?: Date }).deletedAt) {
      throw new NotFoundException({ message: 'Workspace not found.', errorCode: WORKSPACE_DELETE_NOT_FOUND_CODE });
    }
    await this.workspaceModel.updateOne({ _id: new Types.ObjectId(workspaceId) }, { $set: { name: trimmed } });
    return { id: workspaceId, name: trimmed };
  }

  private isPaidWorkspaceSubscription(subscription: {
    planKey: PlanKey;
    status: WorkspaceSubscriptionStatus;
  } | null): boolean {
    if (!subscription) return false;
    if (subscription.planKey === 'free') return false;
    if (subscription.status === 'free' || subscription.status === 'trialing') return false;
    return true;
  }

  async deleteWorkspaceForOwner(workspaceId: string, actingUserId: string): Promise<void> {
    await assertWorkspaceOwnerMembership(this.membershipModel, actingUserId, workspaceId);
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ message: 'Workspace not found.', errorCode: WORKSPACE_DELETE_NOT_FOUND_CODE });
    }

    const ws = await this.workspaceModel.findById(workspaceId).select('name deletedAt').lean();
    if (!ws || (ws as { deletedAt?: Date }).deletedAt) {
      throw new NotFoundException({ message: 'Workspace not found.', errorCode: WORKSPACE_DELETE_NOT_FOUND_CODE });
    }

    const workspaceName = String((ws as { name?: string }).name ?? '').trim();
    if (workspaceName === ASSISTRIO_PLATFORM_WORKSPACE_NAME) {
      throw new ForbiddenException({
        message: WORKSPACE_DELETE_PLATFORM_FORBIDDEN_MESSAGE,
        errorCode: WORKSPACE_DELETE_PLATFORM_FORBIDDEN_CODE,
      });
    }

    const subscription = await this.workspaceSubscriptionsService.findByWorkspaceId(workspaceId);
    if (!this.isPaidWorkspaceSubscription(subscription)) {
      throw new ForbiddenException({
        message: WORKSPACE_DELETE_PAID_REQUIRED_MESSAGE,
        errorCode: WORKSPACE_DELETE_PAID_REQUIRED_CODE,
      });
    }

    const wsOid = new Types.ObjectId(workspaceId);
    const deletedAt = new Date();
    await this.workspaceModel.updateOne({ _id: wsOid }, { $set: { deletedAt } });

    const memberUserIds = (await this.membershipModel.find({ workspaceId: wsOid }).select('userId').lean()) as {
      userId: Types.ObjectId;
    }[];
    for (const row of memberUserIds) {
      await this.clearActiveWorkspaceIfMatches(String(row.userId), workspaceId);
    }
  }

  async getMemberBotGrants(workspaceId: string, userId: string) {
    return this.botAccessGrantService.listSubjectBotGrants({
      workspaceId,
      subjectType: 'user',
      userId,
    });
  }

  async getInviteBotGrants(workspaceId: string, inviteId: string) {
    return this.botAccessGrantService.listSubjectBotGrants({
      workspaceId,
      subjectType: 'invite',
      inviteId,
    });
  }

  async updateMemberBotGrants(params: {
    workspaceId: string;
    userId: string;
    actingUserId: string;
    grants: Array<{ botId: string; canView: boolean; canPreview: boolean }>;
  }) {
    await assertWorkspaceOwnerMembership(this.membershipModel, params.actingUserId, params.workspaceId);
    const membership = await this.membershipModel
      .findOne({
        workspaceId: new Types.ObjectId(params.workspaceId),
        userId: new Types.ObjectId(params.userId),
      })
      .select('role')
      .lean();
    if (!membership) {
      throw new NotFoundException({ message: 'Member not found in workspace.' });
    }
    if (isWorkspaceOwnerRole((membership as { role?: WorkspaceMemberRole }).role ?? 'member')) {
      throw new ForbiddenException({
        message: 'Workspace owner access cannot be edited.',
        errorCode: WORKSPACE_OWNER_PROTECTED_CODE,
      });
    }
    return this.botAccessGrantService.updateSubjectBotGrants({
      workspaceId: params.workspaceId,
      createdByUserId: params.actingUserId,
      subjectType: 'user',
      userId: params.userId,
      grants: params.grants,
    });
  }

  async updateInviteBotGrants(params: {
    workspaceId: string;
    inviteId: string;
    actingUserId: string;
    grants: Array<{ botId: string; canView: boolean; canPreview: boolean }>;
  }) {
    await assertWorkspaceOwnerMembership(this.membershipModel, params.actingUserId, params.workspaceId);
    return this.botAccessGrantService.updateSubjectBotGrants({
      workspaceId: params.workspaceId,
      createdByUserId: params.actingUserId,
      subjectType: 'invite',
      inviteId: params.inviteId,
      grants: params.grants,
    });
  }
}
