import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const WORKSPACE_MEMBER_ROLES = ['admin', 'member'] as const;
export type WorkspaceMemberRole = (typeof WORKSPACE_MEMBER_ROLES)[number];

@Schema({ timestamps: false, collection: 'workspace_memberships' })
export class WorkspaceMembership {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: WORKSPACE_MEMBER_ROLES, default: 'member' })
  role: WorkspaceMemberRole;
}

export const WorkspaceMembershipSchema = SchemaFactory.createForClass(WorkspaceMembership);
WorkspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
