import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WORKSPACE_INVITE_ALREADY_PENDING_CODE,
  WORKSPACE_INVITE_ALREADY_PENDING_MESSAGE,
  WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE,
  WORKSPACE_INVITE_CANCELLED_CODE,
  WORKSPACE_INVITE_DEFAULT_TTL_MS,
  WORKSPACE_INVITE_EMAIL_MISMATCH_CODE,
  WORKSPACE_INVITE_EXPIRED_CODE,
  WORKSPACE_INVITE_MEMBER_EXISTS_CODE,
  WORKSPACE_INVITE_NOT_FOUND_CODE,
  workspaceInviteExpiresAtFromNow,
  type WorkspaceInviteStatus,
  type WorkspaceInviteRole,
} from '../models/workspace-invite.constants';
import { WorkspaceInvite } from '../models/workspace-invite.schema';
import { User } from '../models/user.schema';
import { Workspace } from '../models/workspace.schema';
import { WorkspaceMembership } from '../models/workspace-membership.schema';
import { WorkspaceMemberLimitService } from '../entitlements/workspace-member-limit.service';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceBotAccessGrantService } from './workspace-bot-access-grant.service';
import {
  createWorkspaceInviteToken,
  hashWorkspaceInviteToken,
} from './workspace-invite-token.util';
import { serializeWorkspaceInvite, type WorkspaceInvitePreview } from './workspace-invite.types';
import { filterCustomerVisibleInvites } from './workspace-invite-visibility.util';

export type CreatePendingInviteInput = {
  workspaceId: string;
  email: string;
  role?: WorkspaceInviteRole;
  invitedByUserId: string;
  now?: Date;
};

export type CreatePendingInviteResult = {
  invite: WorkspaceInvite;
  plainToken: string;
};

export type ResendInviteResult = CreatePendingInviteResult;

/** Normalize invite email for storage and lookup (lowercase, trimmed). */
export function normalizeInviteEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

type InviteDoc = WorkspaceInvite & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date };

@Injectable()
export class WorkspaceInviteService {
  constructor(
    @InjectModel(WorkspaceInvite.name) private readonly inviteModel: Model<WorkspaceInvite>,
    @InjectModel(WorkspaceMembership.name) private readonly membershipModel: Model<WorkspaceMembership>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    private readonly memberLimitService: WorkspaceMemberLimitService,
    private readonly workspacesService: WorkspacesService,
    private readonly botAccessGrantService: WorkspaceBotAccessGrantService,
  ) {}

  /**
   * Creates a pending workspace invite.
   *
   * Duplicate behavior: if a non-expired pending invite exists for the same workspace/email,
   * throws 409 `workspace_invite_already_pending`.
   *
   * Expired pending invites: status is set to `expired`, then a new invite is created.
   */
  async createPendingInvite(input: CreatePendingInviteInput): Promise<CreatePendingInviteResult> {
    const workspaceId = String(input.workspaceId ?? '').trim();
    const invitedByUserId = String(input.invitedByUserId ?? '').trim();
    const email = normalizeInviteEmail(input.email);
    const role: WorkspaceInviteRole = input.role ?? 'member';
    const now = input.now ?? new Date();

    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(invitedByUserId)) {
      throw new Error('Invalid workspace or inviter id');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Invalid invite email');
    }

    await this.assertEmailNotAlreadyMember(workspaceId, email);
    await this.memberLimitService.assertCanInviteMember(workspaceId, { now });

    const wsOid = new Types.ObjectId(workspaceId);
    const existingPending = await this.inviteModel
      .findOne({ workspaceId: wsOid, email, status: 'pending' as WorkspaceInviteStatus })
      .exec();

    if (existingPending) {
      const expiresAt = (existingPending as { expiresAt?: Date }).expiresAt;
      if (expiresAt && expiresAt.getTime() > now.getTime()) {
        throw new ConflictException({
          message: WORKSPACE_INVITE_ALREADY_PENDING_MESSAGE,
          errorCode: WORKSPACE_INVITE_ALREADY_PENDING_CODE,
        });
      }

      await this.inviteModel.updateOne(
        { _id: (existingPending as { _id: Types.ObjectId })._id },
        { $set: { status: 'expired' as WorkspaceInviteStatus } },
      );
    }

    const plainToken = createWorkspaceInviteToken();
    const tokenHash = hashWorkspaceInviteToken(plainToken);
    const expiresAt = workspaceInviteExpiresAtFromNow(now, WORKSPACE_INVITE_DEFAULT_TTL_MS);

    const invite = await this.inviteModel.create({
      workspaceId: wsOid,
      email,
      role,
      tokenHash,
      status: 'pending' as WorkspaceInviteStatus,
      invitedByUserId: new Types.ObjectId(invitedByUserId),
      expiresAt,
    });

    return { invite, plainToken };
  }

  async listInvitesForWorkspace(workspaceId: string): Promise<ReturnType<typeof serializeWorkspaceInvite>[]> {
    if (!Types.ObjectId.isValid(workspaceId)) return [];
    const wsOid = new Types.ObjectId(workspaceId);
    const [rows, memberships] = await Promise.all([
      this.inviteModel.find({ workspaceId: wsOid }).sort({ createdAt: -1 }).exec(),
      this.membershipModel.find({ workspaceId: wsOid }).select('userId').lean(),
    ]);

    const userIds = (memberships as { userId: Types.ObjectId }[]).map((row) => row.userId);
    const users = userIds.length
      ? await this.userModel.find({ _id: { $in: userIds } }).select('email').lean()
      : [];
    const memberEmails = (users as { email?: string }[]).map((user) => String(user.email ?? ''));

    const visible = filterCustomerVisibleInvites(
      rows.map((row) => row as InviteDoc),
      memberEmails,
    );

    return visible.map((row) => serializeWorkspaceInvite(row as InviteDoc));
  }

  async cancelInvite(workspaceId: string, inviteId: string, now: Date = new Date()): Promise<void> {
    const invite = await this.findInviteInWorkspace(workspaceId, inviteId);
    if (!invite) {
      throw new NotFoundException({
        message: 'Workspace invite not found.',
        errorCode: WORKSPACE_INVITE_NOT_FOUND_CODE,
      });
    }

    if (invite.status === 'accepted') {
      throw new GoneException({
        message: 'This invite has already been accepted.',
        errorCode: WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE,
      });
    }

    if (invite.status === 'cancelled') {
      return;
    }

    await this.botAccessGrantService.deleteInviteGrants(workspaceId, inviteId);
    await this.inviteModel.deleteOne({ _id: invite._id });
  }

  async resendInvite(
    workspaceId: string,
    inviteId: string,
    now: Date = new Date(),
  ): Promise<ResendInviteResult> {
    const invite = await this.findInviteInWorkspace(workspaceId, inviteId);
    if (!invite) {
      throw new NotFoundException({
        message: 'Workspace invite not found.',
        errorCode: WORKSPACE_INVITE_NOT_FOUND_CODE,
      });
    }

    if (invite.status === 'accepted') {
      throw new GoneException({
        message: 'This invite has already been accepted.',
        errorCode: WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE,
      });
    }

    if (invite.status === 'cancelled') {
      throw new GoneException({
        message: 'This invite has been cancelled.',
        errorCode: WORKSPACE_INVITE_CANCELLED_CODE,
      });
    }

    const isExpiredByTime =
      invite.status === 'expired' ||
      (invite.status === 'pending' && invite.expiresAt.getTime() <= now.getTime());

    if (invite.status !== 'pending' && !isExpiredByTime) {
      throw new GoneException({
        message: 'This invite cannot be resent.',
        errorCode: WORKSPACE_INVITE_EXPIRED_CODE,
      });
    }

    await this.assertEmailNotAlreadyMember(workspaceId, invite.email);
    await this.memberLimitService.assertCanInviteMember(workspaceId, { now });

    const plainToken = createWorkspaceInviteToken();
    const tokenHash = hashWorkspaceInviteToken(plainToken);
    const expiresAt = workspaceInviteExpiresAtFromNow(now, WORKSPACE_INVITE_DEFAULT_TTL_MS);

    await this.inviteModel.updateOne(
      { _id: invite._id },
      {
        $set: {
          tokenHash,
          expiresAt,
          status: 'pending' as WorkspaceInviteStatus,
          cancelledAt: null,
        },
        $unset: { acceptedAt: '', acceptedByUserId: '' },
      },
    );

    const updated = await this.inviteModel.findById(invite._id).exec();
    if (!updated) {
      throw new NotFoundException({
        message: 'Workspace invite not found.',
        errorCode: WORKSPACE_INVITE_NOT_FOUND_CODE,
      });
    }

    return { invite: updated, plainToken };
  }

  async previewInviteByToken(token: string, now: Date = new Date()): Promise<WorkspaceInvitePreview> {
    const invite = await this.findInviteByPlainToken(token);
    if (!invite) {
      throw new NotFoundException({
        message: 'Workspace invite not found.',
        errorCode: WORKSPACE_INVITE_NOT_FOUND_CODE,
      });
    }

    this.assertInvitePreviewable(invite, now);

    const workspace = await this.workspaceModel.findById(invite.workspaceId).select('name').lean();
    const inviter = await this.userModel
      .findById(invite.invitedByUserId)
      .select('email firstName lastName')
      .lean();

    const inviterRow = inviter as { email?: string; firstName?: string; lastName?: string } | null;
    const inviterName = [inviterRow?.firstName, inviterRow?.lastName]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(' ');

    return {
      workspaceName: String((workspace as { name?: string } | null)?.name ?? '').trim() || 'Workspace',
      invitedEmail: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviterEmail: inviterRow?.email ?? null,
      inviterName: inviterName || null,
    };
  }

  async acceptInviteForUser(
    token: string,
    userId: string,
    userEmail: string,
    now: Date = new Date(),
  ): Promise<{ workspaceId: string }> {
    const invite = await this.findInviteByPlainToken(token);
    if (!invite) {
      throw new NotFoundException({
        message: 'Workspace invite not found.',
        errorCode: WORKSPACE_INVITE_NOT_FOUND_CODE,
      });
    }

    const normalizedInviteEmail = invite.email;
    const normalizedUserEmail = normalizeInviteEmail(userEmail);
    if (normalizedInviteEmail !== normalizedUserEmail) {
      throw new ForbiddenException({
        message: 'Signed-in email does not match the invited email.',
        errorCode: WORKSPACE_INVITE_EMAIL_MISMATCH_CODE,
        invitedEmail: normalizedInviteEmail,
        currentEmail: normalizedUserEmail,
      });
    }

    const workspaceId = String(invite.workspaceId);
    const alreadyMember = await this.workspacesService.isUserMemberOfWorkspace(userId, workspaceId);

    if (invite.status === 'cancelled') {
      throw new GoneException({
        message: 'This invite has been cancelled.',
        errorCode: WORKSPACE_INVITE_CANCELLED_CODE,
      });
    }

    if (invite.status === 'accepted') {
      if (!alreadyMember) {
        throw new GoneException({
          message: 'This invite has already been accepted.',
          errorCode: WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE,
        });
      }
      await this.workspacesService.activateWorkspaceForUser(userId, workspaceId);
      return { workspaceId };
    }

    this.assertInviteAcceptable(invite, now);

    if (!alreadyMember) {
      await this.memberLimitService.assertCanInviteMember(workspaceId, { now });
      await this.membershipModel.create({
        workspaceId: invite.workspaceId,
        userId: new Types.ObjectId(userId),
        role: invite.role,
      });
    }

    await this.inviteModel.updateOne(
      { _id: invite._id },
      {
        $set: {
          status: 'accepted' as WorkspaceInviteStatus,
          acceptedByUserId: new Types.ObjectId(userId),
          acceptedAt: now,
        },
      },
    );

    await this.workspacesService.activateWorkspaceForUser(userId, workspaceId);
    await this.botAccessGrantService.migrateInviteGrantsToUser({
      workspaceId,
      inviteId: String(invite._id),
      userId,
      createdByUserId: userId,
    });
    return { workspaceId };
  }

  async updateInviteRole(
    workspaceId: string,
    inviteId: string,
    role: WorkspaceInviteRole,
    now: Date = new Date(),
  ): Promise<void> {
    const invite = await this.findInviteInWorkspace(workspaceId, inviteId);
    if (!invite) {
      throw new NotFoundException({
        message: 'Workspace invite not found.',
        errorCode: WORKSPACE_INVITE_NOT_FOUND_CODE,
      });
    }
    if (invite.status === 'accepted' || invite.status === 'cancelled') {
      throw new GoneException({
        message: 'This invite cannot be updated.',
        errorCode: WORKSPACE_INVITE_CANCELLED_CODE,
      });
    }
    if (invite.status === 'pending' && invite.expiresAt.getTime() <= now.getTime()) {
      // allow role change on expired pending invites treated as expired status
    }
    await this.inviteModel.updateOne({ _id: invite._id }, { $set: { role } });
  }

  private async assertEmailNotAlreadyMember(workspaceId: string, email: string): Promise<void> {
    const existingUser = await this.userModel.findOne({ email }).select('_id').lean();
    if (!existingUser) return;

    const userId = (existingUser as { _id: Types.ObjectId })._id;
    const membership = await this.membershipModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), userId })
      .select('_id')
      .lean();
    if (membership) {
      throw new ConflictException({
        message: 'This user is already a member of the workspace.',
        errorCode: WORKSPACE_INVITE_MEMBER_EXISTS_CODE,
      });
    }
  }

  private async findInviteInWorkspace(workspaceId: string, inviteId: string): Promise<InviteDoc | null> {
    if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(inviteId)) return null;
    const row = await this.inviteModel
      .findOne({
        _id: new Types.ObjectId(inviteId),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .exec();
    return row as InviteDoc | null;
  }

  private async findInviteByPlainToken(token: string): Promise<InviteDoc | null> {
    const plain = String(token ?? '').trim();
    if (!plain) return null;
    const tokenHash = hashWorkspaceInviteToken(plain);
    const row = await this.inviteModel.findOne({ tokenHash }).exec();
    return row as InviteDoc | null;
  }

  private assertInvitePreviewable(invite: InviteDoc, now: Date): void {
    if (invite.status === 'cancelled') {
      throw new GoneException({
        message: 'This invite has been cancelled.',
        errorCode: WORKSPACE_INVITE_CANCELLED_CODE,
      });
    }
    if (invite.status === 'accepted') {
      throw new GoneException({
        message: 'This invite has already been accepted.',
        errorCode: WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE,
      });
    }
    if (this.isInviteExpired(invite, now)) {
      throw new GoneException({
        message: 'This invite has expired.',
        errorCode: WORKSPACE_INVITE_EXPIRED_CODE,
      });
    }
  }

  private assertInviteAcceptable(invite: InviteDoc, now: Date): void {
    if (invite.status === 'cancelled') {
      throw new GoneException({
        message: 'This invite has been cancelled.',
        errorCode: WORKSPACE_INVITE_CANCELLED_CODE,
      });
    }
    if (invite.status === 'accepted') {
      throw new GoneException({
        message: 'This invite has already been accepted.',
        errorCode: WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE,
      });
    }
    if (this.isInviteExpired(invite, now)) {
      throw new GoneException({
        message: 'This invite has expired.',
        errorCode: WORKSPACE_INVITE_EXPIRED_CODE,
      });
    }
    if (invite.status !== 'pending') {
      throw new GoneException({
        message: 'This invite is no longer valid.',
        errorCode: WORKSPACE_INVITE_EXPIRED_CODE,
      });
    }
  }

  private isInviteExpired(invite: InviteDoc, now: Date): boolean {
    return invite.status === 'expired' || invite.expiresAt.getTime() <= now.getTime();
  }
}
