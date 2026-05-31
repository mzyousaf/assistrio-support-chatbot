import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  User,
  Bot,
  WorkspaceBotAccessGrant,
  WorkspaceInvite,
  WorkspaceMembership,
  type WorkspaceMemberRole,
} from '../models';
import { botNotDeletedClause } from '../bots/bot-not-deleted.util';
import type { WorkspaceInviteStatus } from '../models/workspace-invite.constants';
import { isWorkspaceOwnerRole } from '../models/workspace-membership-role.util';
import {
  isBotMemberPreviewAllowed,
  isBotVisibleToWorkspaceMembers,
} from './workspace-bot-member-visibility.util';
import {
  BotAccessGrantInput,
  BotAccessGrantRow,
  BotViewAccessPreviewMember,
  normalizeGrantFlags,
  oidString,
} from './workspace-bot-access-grant.util';
import {
  resolveWorkspaceMemberAvatarUrl,
  resolveWorkspaceMemberDisplayName,
} from './workspace-member-display.util';
import {
  filterCustomerVisibleInvites,
  getCustomerInviteRowStatus,
  normalizeWorkspacePersonEmail,
} from './workspace-invite-visibility.util';
import type { WorkspaceDefaultBotAccessPolicy } from './workspace-default-bot-access-policy.util';

export type SubjectBotGrantItem = {
  botId: string;
  botName: string;
  canView: boolean;
  canPreview: boolean;
};

export type SubjectBotGrantsResponse = {
  grants: SubjectBotGrantItem[];
  botAccessSummary: { viewable: number; previewable: number };
};

type GrantDoc = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  botId: Types.ObjectId;
  userId?: Types.ObjectId;
  inviteId?: Types.ObjectId;
  email?: string;
  subjectType: 'user' | 'invite';
  canView: boolean;
  canPreview: boolean;
};

@Injectable()
export class WorkspaceBotAccessGrantService {
  constructor(
    @InjectModel(WorkspaceBotAccessGrant.name)
    private readonly grantModel: Model<WorkspaceBotAccessGrant>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(WorkspaceMembership.name)
    private readonly membershipModel: Model<WorkspaceMembership>,
    @InjectModel(WorkspaceInvite.name) private readonly inviteModel: Model<WorkspaceInvite>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async botHasExplicitUserGrants(botId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId)) return false;
    const row = await this.grantModel
      .findOne({ botId: new Types.ObjectId(botId), subjectType: 'user' })
      .select('_id')
      .lean();
    return !!row;
  }

  async findUserGrant(botId: string, userId: string): Promise<{ canView: boolean; canPreview: boolean } | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(userId)) return null;
    const row = (await this.grantModel
      .findOne({
        botId: new Types.ObjectId(botId),
        subjectType: 'user',
        userId: new Types.ObjectId(userId),
      })
      .select('canView canPreview')
      .lean()) as { canView?: boolean; canPreview?: boolean } | null;
    if (!row) return null;
    return { canView: row.canView === true, canPreview: row.canPreview === true && row.canView === true };
  }

  legacyMemberAccess(bot: Record<string, unknown>): { canView: boolean; canPreview: boolean } {
    return {
      canView: isBotVisibleToWorkspaceMembers(bot),
      canPreview: isBotVisibleToWorkspaceMembers(bot) && isBotMemberPreviewAllowed(bot),
    };
  }

  async resolveUserBotAccess(
    userId: string,
    memberRole: WorkspaceMemberRole | null,
    bot: Record<string, unknown>,
  ): Promise<{ canView: boolean; canPreview: boolean }> {
    if (memberRole != null && isWorkspaceOwnerRole(memberRole)) {
      return { canView: true, canPreview: true };
    }
    const botId = oidString(bot._id);
    const ws = bot.workspaceId;
    const isWorkspaceBot = ws != null && String(ws).length > 0;
    if (isWorkspaceBot) {
      const grant = await this.findUserGrant(botId, userId);
      return grant ?? { canView: false, canPreview: false };
    }
    return this.legacyMemberAccess(bot);
  }

  async userCanViewBot(userId: string, memberRole: WorkspaceMemberRole | null, bot: Record<string, unknown>): Promise<boolean> {
    const access = await this.resolveUserBotAccess(userId, memberRole, bot);
    return access.canView;
  }

  async userCanPreviewBot(
    userId: string,
    memberRole: WorkspaceMemberRole | null,
    bot: Record<string, unknown>,
  ): Promise<boolean> {
    const access = await this.resolveUserBotAccess(userId, memberRole, bot);
    return access.canPreview;
  }

  async filterBotsForUser(
    userId: string,
    memberRole: WorkspaceMemberRole | null,
    bots: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    if (memberRole != null && isWorkspaceOwnerRole(memberRole)) return bots;
    const out: Record<string, unknown>[] = [];
    for (const bot of bots) {
      if (await this.userCanViewBot(userId, memberRole, bot)) out.push(bot);
    }
    return out;
  }

  async listGrantRowsForBot(params: { workspaceId: string; botId: string }): Promise<BotAccessGrantRow[]> {
    const { workspaceId, botId } = params;
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(botId)) {
      throw new BadRequestException({ message: 'Invalid workspace or AI Agent id.' });
    }

    const wsOid = new Types.ObjectId(workspaceId);
    const botOid = new Types.ObjectId(botId);

    const [memberships, invites, grants] = await Promise.all([
      this.membershipModel.find({ workspaceId: wsOid }).lean(),
      this.inviteModel.find({ workspaceId: wsOid }).sort({ createdAt: -1 }).lean(),
      this.grantModel.find({ workspaceId: wsOid, botId: botOid }).lean(),
    ]);

    const userIds = (memberships as { userId: Types.ObjectId }[]).map((m) => m.userId);
    const users = userIds.length
      ? await this.userModel
          .find({ _id: { $in: userIds } })
          .select('email firstName lastName picture displayNameOverride pictureOverride')
          .lean()
      : [];
    const userById = new Map(
      (users as {
        _id: Types.ObjectId;
        email?: string;
        firstName?: string;
        lastName?: string;
        picture?: string | null;
        displayNameOverride?: string | null;
        pictureOverride?: string | null;
      }[]).map((u) => [String(u._id), u]),
    );

    const memberEmails = (memberships as { userId: Types.ObjectId }[]).map((membership) =>
      normalizeWorkspacePersonEmail(String(userById.get(String(membership.userId))?.email ?? '')),
    );
    const visibleInvites = filterCustomerVisibleInvites(
      invites as { email: string; status: WorkspaceInviteStatus; expiresAt: Date }[],
      memberEmails,
    );

    const grantByUserId = new Map<string, GrantDoc>();
    const grantByInviteId = new Map<string, GrantDoc>();
    for (const g of grants as GrantDoc[]) {
      if (g.subjectType === 'user' && g.userId) grantByUserId.set(String(g.userId), g);
      if (g.subjectType === 'invite' && g.inviteId) grantByInviteId.set(String(g.inviteId), g);
    }

    const rows: BotAccessGrantRow[] = [];

    for (const m of memberships as { userId: Types.ObjectId; role: WorkspaceMemberRole }[]) {
      const uid = String(m.userId);
      const user = userById.get(uid);
      const displayName = user
        ? resolveWorkspaceMemberDisplayName(user)
        : '';
      const grant = grantByUserId.get(uid);
      const isOwner = isWorkspaceOwnerRole(m.role);
      rows.push({
        subjectType: 'user',
        userId: uid,
        email: String(user?.email ?? '').trim(),
        displayName: displayName || String(user?.email ?? '').trim(),
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        avatarUrl: user ? resolveWorkspaceMemberAvatarUrl(user) : null,
        picture: user?.picture ?? null,
        status: 'active',
        role: m.role,
        canView: isOwner ? true : grant?.canView === true,
        canPreview: isOwner ? true : grant?.canPreview === true && grant?.canView === true,
        locked: isOwner,
      });
    }

    for (const inv of visibleInvites as {
      _id: Types.ObjectId;
      email: string;
      role: 'admin' | 'member';
      status: WorkspaceInviteStatus;
      expiresAt: Date;
    }[]) {
      const inviteId = String(inv._id);
      const grant = grantByInviteId.get(inviteId);
      const rowStatus = getCustomerInviteRowStatus(inv);
      const status = rowStatus === 'expired' ? ('expired' as const) : ('pending_invite' as const);
      rows.push({
        subjectType: 'invite',
        inviteId,
        email: inv.email,
        displayName: inv.email,
        status,
        role: inv.role,
        canView: grant?.canView === true,
        canPreview: grant?.canPreview === true && grant?.canView === true,
        locked: false,
      });
    }

    return rows.sort((a, b) => {
      if (a.locked !== b.locked) return a.locked ? -1 : 1;
      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
    });
  }

  async buildViewAccessPreviewByBotIds(
    workspaceId: string,
    botIds: string[],
  ): Promise<Record<string, BotViewAccessPreviewMember[]>> {
    if (!Types.ObjectId.isValid(workspaceId)) return {};
    const validBotIds = [...new Set(botIds.map((id) => String(id).trim()).filter((id) => Types.ObjectId.isValid(id)))];
    if (!validBotIds.length) return {};

    const wsOid = new Types.ObjectId(workspaceId);
    const botOids = validBotIds.map((id) => new Types.ObjectId(id));

    type GrantDoc = {
      botId: Types.ObjectId;
      subjectType: 'user' | 'invite';
      userId?: Types.ObjectId;
      inviteId?: Types.ObjectId;
      canView?: boolean;
    };

    const [memberships, invites, grants] = await Promise.all([
      this.membershipModel.find({ workspaceId: wsOid }).lean(),
      this.inviteModel.find({ workspaceId: wsOid }).sort({ createdAt: -1 }).lean(),
      this.grantModel.find({ workspaceId: wsOid, botId: { $in: botOids }, canView: true }).lean(),
    ]);

    const userIds = (memberships as { userId: Types.ObjectId }[]).map((m) => m.userId);
    const users = userIds.length
      ? await this.userModel
          .find({ _id: { $in: userIds } })
          .select('email firstName lastName picture displayNameOverride pictureOverride')
          .lean()
      : [];
    const userById = new Map(
      (users as {
        _id: Types.ObjectId;
        email?: string;
        firstName?: string | null;
        lastName?: string | null;
        picture?: string | null;
        displayNameOverride?: string | null;
        pictureOverride?: string | null;
      }[]).map((u) => [String(u._id), u]),
    );

    const memberEmails = (memberships as { userId: Types.ObjectId }[]).map((membership) =>
      normalizeWorkspacePersonEmail(String(userById.get(String(membership.userId))?.email ?? '')),
    );
    const visibleInvites = filterCustomerVisibleInvites(
      invites as { _id: Types.ObjectId; email: string; status: WorkspaceInviteStatus; expiresAt: Date }[],
      memberEmails,
    );

    const grantByBotUserId = new Map<string, GrantDoc>();
    const grantByBotInviteId = new Map<string, GrantDoc>();
    for (const grant of grants as GrantDoc[]) {
      const botKey = String(grant.botId);
      if (grant.subjectType === 'user' && grant.userId) {
        grantByBotUserId.set(`${botKey}:${String(grant.userId)}`, grant);
      }
      if (grant.subjectType === 'invite' && grant.inviteId) {
        grantByBotInviteId.set(`${botKey}:${String(grant.inviteId)}`, grant);
      }
    }

    const out: Record<string, BotViewAccessPreviewMember[]> = {};
    for (const botId of validBotIds) {
      const preview: BotViewAccessPreviewMember[] = [];

      for (const membership of memberships as { userId: Types.ObjectId; role: WorkspaceMemberRole }[]) {
        if (isWorkspaceOwnerRole(membership.role)) continue;
        const uid = String(membership.userId);
        if (!grantByBotUserId.has(`${botId}:${uid}`)) continue;
        const user = userById.get(uid);
        const email = String(user?.email ?? '').trim();
        if (!email) continue;
        const displayName = user ? resolveWorkspaceMemberDisplayName(user) : email;
        preview.push({
          email,
          displayName: displayName || email,
          firstName: user?.firstName ?? null,
          lastName: user?.lastName ?? null,
          avatarUrl: user ? resolveWorkspaceMemberAvatarUrl(user) : null,
          picture: user?.picture ?? null,
        });
      }

      for (const invite of visibleInvites as { _id: Types.ObjectId; email: string }[]) {
        const inviteId = String(invite._id);
        if (!grantByBotInviteId.has(`${botId}:${inviteId}`)) continue;
        const email = String(invite.email ?? '').trim();
        if (!email) continue;
        preview.push({
          email,
          displayName: email,
          firstName: null,
          lastName: null,
          avatarUrl: null,
          picture: null,
        });
      }

      preview.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
      out[botId] = preview;
    }

    return out;
  }

  async applyDefaultAccessGrantsForNewBot(params: {
    workspaceId: string;
    botId: string;
    createdByUserId: string;
    policy: WorkspaceDefaultBotAccessPolicy;
  }): Promise<void> {
    const flags = normalizeGrantFlags(
      params.policy.grantViewToWorkspacePeopleOnCreate || params.policy.grantPreviewToWorkspacePeopleOnCreate,
      params.policy.grantPreviewToWorkspacePeopleOnCreate,
    );
    if (!flags.canView && !flags.canPreview) return;

    const wsOid = new Types.ObjectId(params.workspaceId);
    const memberships = (await this.membershipModel
      .find({ workspaceId: wsOid })
      .select('userId role')
      .lean()) as { userId: Types.ObjectId; role: WorkspaceMemberRole }[];

    const grants: BotAccessGrantInput[] = [];
    for (const membership of memberships) {
      if (isWorkspaceOwnerRole(membership.role)) continue;
      grants.push({
        subjectType: 'user',
        userId: String(membership.userId),
        canView: flags.canView,
        canPreview: flags.canPreview,
      });
    }
    if (!grants.length) return;

    await this.upsertGrantsForBot({
      workspaceId: params.workspaceId,
      botId: params.botId,
      createdByUserId: params.createdByUserId,
      grants,
    });
  }

  async upsertGrantsForBot(params: {
    workspaceId: string;
    botId: string;
    createdByUserId: string;
    grants: BotAccessGrantInput[];
  }): Promise<BotAccessGrantRow[]> {
    const { workspaceId, botId, createdByUserId, grants } = params;
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(createdByUserId)) {
      throw new BadRequestException({ message: 'Invalid ids.' });
    }

    const wsOid = new Types.ObjectId(workspaceId);
    const botOid = new Types.ObjectId(botId);
    const creatorOid = new Types.ObjectId(createdByUserId);

    for (const g of grants) {
      const flags = normalizeGrantFlags(g.canView, g.canPreview);
      if (g.subjectType === 'user') {
        const uid = String(g.userId ?? '').trim();
        if (!Types.ObjectId.isValid(uid)) {
          throw new BadRequestException({ message: 'Invalid userId in grant.' });
        }
        const membership = await this.membershipModel
          .findOne({ workspaceId: wsOid, userId: new Types.ObjectId(uid) })
          .select('role')
          .lean();
        if (!membership) {
          throw new BadRequestException({ message: 'Grant user is not a workspace member.' });
        }
        const membershipRole = (membership as { role?: WorkspaceMemberRole }).role;
        if (membershipRole != null && isWorkspaceOwnerRole(membershipRole)) {
          continue;
        }
        if (!flags.canView && !flags.canPreview) {
          await this.grantModel.deleteOne({
            botId: botOid,
            subjectType: 'user',
            userId: new Types.ObjectId(uid),
          });
          continue;
        }
        const user = await this.userModel.findById(uid).select('email').lean();
        await this.grantModel.findOneAndUpdate(
          { botId: botOid, subjectType: 'user', userId: new Types.ObjectId(uid) },
          {
            $set: {
              workspaceId: wsOid,
              botId: botOid,
              subjectType: 'user',
              userId: new Types.ObjectId(uid),
              email: String((user as { email?: string } | null)?.email ?? '').trim().toLowerCase(),
              canView: flags.canView,
              canPreview: flags.canPreview,
              createdByUserId: creatorOid,
            },
          },
          { upsert: true, new: true },
        );
      } else {
        const iid = String(g.inviteId ?? '').trim();
        if (!Types.ObjectId.isValid(iid)) {
          throw new BadRequestException({ message: 'Invalid inviteId in grant.' });
        }
        const invite = await this.inviteModel
          .findOne({ _id: new Types.ObjectId(iid), workspaceId: wsOid })
          .select('email status')
          .lean();
        if (!invite) {
          throw new NotFoundException({ message: 'Invite not found in workspace.' });
        }
        if ((invite as { status?: string }).status === 'accepted') {
          throw new BadRequestException({ message: 'Cannot grant access for accepted invite.' });
        }
        if (!flags.canView && !flags.canPreview) {
          await this.grantModel.deleteOne({
            botId: botOid,
            subjectType: 'invite',
            inviteId: new Types.ObjectId(iid),
          });
          continue;
        }
        await this.grantModel.findOneAndUpdate(
          { botId: botOid, subjectType: 'invite', inviteId: new Types.ObjectId(iid) },
          {
            $set: {
              workspaceId: wsOid,
              botId: botOid,
              subjectType: 'invite',
              inviteId: new Types.ObjectId(iid),
              email: String((invite as { email?: string }).email ?? '').trim().toLowerCase(),
              canView: flags.canView,
              canPreview: flags.canPreview,
              createdByUserId: creatorOid,
            },
          },
          { upsert: true, new: true },
        );
      }
    }

    return this.listGrantRowsForBot({ workspaceId, botId });
  }

  async migrateInviteGrantsToUser(params: {
    workspaceId: string;
    inviteId: string;
    userId: string;
    createdByUserId: string;
  }): Promise<void> {
    const { workspaceId, inviteId, userId, createdByUserId } = params;
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(inviteId) || !Types.ObjectId.isValid(userId)) {
      return;
    }
    const wsOid = new Types.ObjectId(workspaceId);
    const inviteOid = new Types.ObjectId(inviteId);
    const userOid = new Types.ObjectId(userId);
    const creatorOid = new Types.ObjectId(createdByUserId);

    const inviteGrants = (await this.grantModel
      .find({ workspaceId: wsOid, subjectType: 'invite', inviteId: inviteOid })
      .lean()) as GrantDoc[];

    for (const g of inviteGrants) {
      const flags = normalizeGrantFlags(g.canView, g.canPreview);
      if (!flags.canView && !flags.canPreview) continue;
      await this.grantModel.findOneAndUpdate(
        { botId: g.botId, subjectType: 'user', userId: userOid },
        {
          $set: {
            workspaceId: wsOid,
            botId: g.botId,
            subjectType: 'user',
            userId: userOid,
            email: g.email,
            canView: flags.canView,
            canPreview: flags.canPreview,
            createdByUserId: creatorOid,
          },
        },
        { upsert: true },
      );
    }

    await this.grantModel.deleteMany({ workspaceId: wsOid, subjectType: 'invite', inviteId: inviteOid });
  }

  async deleteInviteGrants(workspaceId: string, inviteId: string): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(inviteId)) return;
    await this.grantModel.deleteMany({
      workspaceId: new Types.ObjectId(workspaceId),
      subjectType: 'invite',
      inviteId: new Types.ObjectId(inviteId),
    });
  }

  async summarizeUserBotAccess(workspaceId: string, userId: string): Promise<{ viewable: number; previewable: number }> {
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(userId)) {
      return { viewable: 0, previewable: 0 };
    }
    const grants = (await this.grantModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        subjectType: 'user',
        userId: new Types.ObjectId(userId),
      })
      .select('canView canPreview')
      .lean()) as { canView?: boolean; canPreview?: boolean }[];
    return {
      viewable: grants.filter((g) => g.canView === true).length,
      previewable: grants.filter((g) => g.canPreview === true && g.canView === true).length,
    };
  }

  async summarizeInviteBotAccess(workspaceId: string, inviteId: string): Promise<{ viewable: number; previewable: number }> {
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(inviteId)) {
      return { viewable: 0, previewable: 0 };
    }
    const grants = (await this.grantModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        subjectType: 'invite',
        inviteId: new Types.ObjectId(inviteId),
      })
      .select('canView canPreview')
      .lean()) as { canView?: boolean; canPreview?: boolean }[];
    return {
      viewable: grants.filter((g) => g.canView === true).length,
      previewable: grants.filter((g) => g.canPreview === true && g.canView === true).length,
    };
  }

  private summarizeGrantItems(grants: SubjectBotGrantItem[]): { viewable: number; previewable: number } {
    return {
      viewable: grants.filter((g) => g.canView).length,
      previewable: grants.filter((g) => g.canPreview && g.canView).length,
    };
  }

  private async loadWorkspaceBots(workspaceId: string): Promise<Array<{ _id: Types.ObjectId; name?: string }>> {
    if (!Types.ObjectId.isValid(workspaceId)) return [];
    return (await this.botModel
      .find({
        $and: [{ workspaceId: new Types.ObjectId(workspaceId) }, botNotDeletedClause()],
      })
      .select('name')
      .sort({ createdAt: -1 })
      .lean()) as Array<{ _id: Types.ObjectId; name?: string }>;
  }

  async listSubjectBotGrants(params: {
    workspaceId: string;
    subjectType: 'user' | 'invite';
    userId?: string;
    inviteId?: string;
  }): Promise<SubjectBotGrantsResponse> {
    const { workspaceId, subjectType } = params;
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new BadRequestException({ message: 'Invalid workspace id.' });
    }

    const wsOid = new Types.ObjectId(workspaceId);
    const bots = await this.loadWorkspaceBots(workspaceId);

    const grantFilter: Record<string, unknown> = { workspaceId: wsOid, subjectType };
    if (subjectType === 'user') {
      const userId = String(params.userId ?? '').trim();
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException({ message: 'Invalid user id.' });
      }
      grantFilter.userId = new Types.ObjectId(userId);
    } else {
      const inviteId = String(params.inviteId ?? '').trim();
      if (!Types.ObjectId.isValid(inviteId)) {
        throw new BadRequestException({ message: 'Invalid invite id.' });
      }
      grantFilter.inviteId = new Types.ObjectId(inviteId);
    }

    const grants = (await this.grantModel.find(grantFilter).lean()) as GrantDoc[];
    const grantByBotId = new Map(grants.map((g) => [String(g.botId), g]));

    const items: SubjectBotGrantItem[] = bots.map((bot) => {
      const botId = String(bot._id);
      const grant = grantByBotId.get(botId);
      const flags = normalizeGrantFlags(grant?.canView, grant?.canPreview);
      return {
        botId,
        botName: String(bot.name ?? '').trim() || 'Agent',
        canView: flags.canView,
        canPreview: flags.canPreview,
      };
    });

    return {
      grants: items,
      botAccessSummary: this.summarizeGrantItems(items),
    };
  }

  async updateSubjectBotGrants(params: {
    workspaceId: string;
    createdByUserId: string;
    subjectType: 'user' | 'invite';
    userId?: string;
    inviteId?: string;
    grants: Array<{ botId: string; canView: boolean; canPreview: boolean }>;
  }): Promise<SubjectBotGrantsResponse> {
    const { workspaceId, createdByUserId, subjectType, grants } = params;
    for (const item of grants) {
      const botId = String(item.botId ?? '').trim();
      if (!botId) continue;
      const patch: BotAccessGrantInput = {
        subjectType,
        canView: item.canView === true,
        canPreview: item.canPreview === true,
      };
      if (subjectType === 'user') {
        patch.userId = String(params.userId ?? '').trim();
      } else {
        patch.inviteId = String(params.inviteId ?? '').trim();
      }
      await this.upsertGrantsForBot({
        workspaceId,
        botId,
        createdByUserId,
        grants: [patch],
      });
    }

    return this.listSubjectBotGrants({
      workspaceId,
      subjectType,
      userId: params.userId,
      inviteId: params.inviteId,
    });
  }
}
