import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const WORKSPACE_OWNER_ROLE = 'owner' as const;
export const WORKSPACE_ADMIN_ROLE = 'admin' as const;
export const WORKSPACE_MEMBER_ROLE = 'member' as const;

export const WORKSPACE_MEMBER_ROLES = [
  WORKSPACE_OWNER_ROLE,
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MEMBER_ROLE,
] as const;
export type WorkspaceMemberRole = (typeof WORKSPACE_MEMBER_ROLES)[number];

/** Roles that may manage workspace settings, bots, and members (owner or admin). */
export const WORKSPACE_MANAGER_ROLES = [WORKSPACE_OWNER_ROLE, WORKSPACE_ADMIN_ROLE] as const;
export type WorkspaceManagerRole = (typeof WORKSPACE_MANAGER_ROLES)[number];

@Schema({ timestamps: false, collection: 'workspace_memberships' })
export class WorkspaceMembership {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: WORKSPACE_MEMBER_ROLES, default: WORKSPACE_MEMBER_ROLE })
  role: WorkspaceMemberRole;
}

export const WorkspaceMembershipSchema = SchemaFactory.createForClass(WorkspaceMembership);
WorkspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
/** At most one owner per workspace (safe after backfill-workspace-owner-role.js). */
WorkspaceMembershipSchema.index(
  { workspaceId: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: WORKSPACE_OWNER_ROLE } },
);
