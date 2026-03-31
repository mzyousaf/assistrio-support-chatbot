import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Platform roles: `superadmin` (Assistrio staff), `customer` (tenant accounts).
 * Workspace roles (admin/member) live on WorkspaceMembership, not here.
 */
export const USER_ROLES = ['superadmin', 'customer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Schema({ timestamps: false, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;
  @Prop({ required: true })
  passwordHash: string;
  @Prop({ required: true, enum: USER_ROLES, default: 'customer' })
  role: UserRole;
  @Prop({ default: Date.now })
  createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
