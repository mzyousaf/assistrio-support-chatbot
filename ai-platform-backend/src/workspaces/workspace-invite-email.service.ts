import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmailService, type SendEmailResult } from '../email/email.service';
import { buildWorkspaceInviteEmailContent } from '../email/workspace-invite-email.template';
import { User } from '../models/user.schema';
import { Workspace } from '../models/workspace.schema';
import type { WorkspaceInviteRole } from '../models/workspace-invite.constants';

export type SendWorkspaceInviteEmailInput = {
  workspaceId: string;
  invitedByUserId: string;
  recipientEmail: string;
  role: WorkspaceInviteRole;
  expiresAt: Date;
  inviteUrl: string;
};

@Injectable()
export class WorkspaceInviteEmailService {
  constructor(
    private readonly emailService: EmailService,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async sendWorkspaceInviteEmail(input: SendWorkspaceInviteEmailInput): Promise<SendEmailResult> {
    const workspaceName = await this.resolveWorkspaceName(input.workspaceId);
    const inviter = await this.resolveInviter(input.invitedByUserId);
    const { subject, html, text } = buildWorkspaceInviteEmailContent({
      workspaceName,
      inviterName: inviter.name,
      inviterEmail: inviter.email,
      invitedRole: input.role,
      expiresAt: input.expiresAt,
      inviteUrl: input.inviteUrl,
    });

    return this.emailService.send({
      to: input.recipientEmail,
      subject,
      html,
      text,
      replyTo: inviter.email ?? undefined,
    });
  }

  private async resolveWorkspaceName(workspaceId: string): Promise<string> {
    if (!Types.ObjectId.isValid(workspaceId)) return 'Workspace';
    const workspace = await this.workspaceModel.findById(workspaceId).select('name').lean();
    const name = (workspace as { name?: string } | null)?.name?.trim();
    return name || 'Workspace';
  }

  private async resolveInviter(
    invitedByUserId: string,
  ): Promise<{ name: string | null; email: string | null }> {
    if (!Types.ObjectId.isValid(invitedByUserId)) {
      return { name: null, email: null };
    }
    const user = await this.userModel
      .findById(invitedByUserId)
      .select('email firstName lastName')
      .lean();
    if (!user) return { name: null, email: null };
    const row = user as { email?: string; firstName?: string | null; lastName?: string | null };
    const parts = [row.firstName?.trim(), row.lastName?.trim()].filter(Boolean);
    return {
      name: parts.length ? parts.join(' ') : null,
      email: row.email?.trim() || null,
    };
  }
}
