import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const WORKSPACE_BOT_ACCESS_GRANT_SUBJECT_TYPES = ['user', 'invite'] as const;
export type WorkspaceBotAccessGrantSubjectType = (typeof WORKSPACE_BOT_ACCESS_GRANT_SUBJECT_TYPES)[number];

@Schema({ timestamps: true, collection: 'workspace_bot_access_grants' })
export class WorkspaceBotAccessGrant {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true, index: true })
  botId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkspaceInvite', required: false })
  inviteId?: Types.ObjectId;

  @Prop({ required: false, lowercase: true, trim: true })
  email?: string;

  @Prop({ required: true, enum: WORKSPACE_BOT_ACCESS_GRANT_SUBJECT_TYPES })
  subjectType: WorkspaceBotAccessGrantSubjectType;

  @Prop({ required: true, default: false })
  canView: boolean;

  @Prop({ required: true, default: false })
  canPreview: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdByUserId: Types.ObjectId;
}

export const WorkspaceBotAccessGrantSchema = SchemaFactory.createForClass(WorkspaceBotAccessGrant);

WorkspaceBotAccessGrantSchema.index(
  { botId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { subjectType: 'user' } },
);
WorkspaceBotAccessGrantSchema.index(
  { botId: 1, inviteId: 1 },
  { unique: true, partialFilterExpression: { subjectType: 'invite' } },
);
WorkspaceBotAccessGrantSchema.index({ workspaceId: 1, botId: 1 });
WorkspaceBotAccessGrantSchema.index({ workspaceId: 1, userId: 1 });
