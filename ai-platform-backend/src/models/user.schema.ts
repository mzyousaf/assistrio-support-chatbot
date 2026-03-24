import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Unified user model. Admin panel access is for any authenticated user.
 * Legacy: 'superadmin' may still exist in DB; prefer 'admin' for new/seed users.
 */
export const USER_ROLES = ['superadmin', 'admin', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Schema({ timestamps: false, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;
  @Prop({ required: true })
  passwordHash: string;
  @Prop({ required: true, enum: USER_ROLES, default: 'viewer' })
  role: UserRole;
  @Prop({ default: Date.now })
  createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
