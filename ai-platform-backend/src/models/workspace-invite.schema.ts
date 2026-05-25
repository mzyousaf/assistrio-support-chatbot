import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  WORKSPACE_INVITE_STATUSES,
  WORKSPACE_INVITE_DEFAULT_TTL_MS,
  workspaceInviteExpiresAtFromNow,
  type WorkspaceInviteStatus,
} from './workspace-invite.constants';
import { WORKSPACE_INVITE_ROLES, type WorkspaceInviteRole } from './workspace-invite.constants';

@Schema({ timestamps: true, collection: 'workspace_invites' })
export class WorkspaceInvite {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, enum: WORKSPACE_INVITE_ROLES, default: 'member' })
  role: WorkspaceInviteRole;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true, enum: WORKSPACE_INVITE_STATUSES, default: 'pending' })
  status: WorkspaceInviteStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedByUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  acceptedByUserId?: Types.ObjectId;

  @Prop({
    type: Date,
    required: true,
    default: () => workspaceInviteExpiresAtFromNow(new Date(), WORKSPACE_INVITE_DEFAULT_TTL_MS),
  })
  expiresAt: Date;

  @Prop({ type: Date, required: false })
  acceptedAt?: Date;

  @Prop({ type: Date, required: false })
  cancelledAt?: Date;
}

export const WorkspaceInviteSchema = SchemaFactory.createForClass(WorkspaceInvite);

WorkspaceInviteSchema.index({ tokenHash: 1 }, { unique: true });
WorkspaceInviteSchema.index({ workspaceId: 1, status: 1 });
WorkspaceInviteSchema.index({ workspaceId: 1, email: 1, status: 1 });
WorkspaceInviteSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
