import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Platform roles: `superadmin` (Assistrio staff), `customer` (tenant accounts).
 * Workspace roles (admin/member) live on WorkspaceMembership, not here.
 */
export const USER_ROLES = ['superadmin', 'customer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * How the user may sign in. A document may list multiple providers after linking (future).
 * - `password`: email+password credential (`passwordHash` required for login).
 * - `google`: Google OAuth (requires `googleSubject`; `passwordHash` optional).
 *
 * Legacy documents may omit `authProviders`; if `passwordHash` is set, password login is allowed.
 */
export const AUTH_ACCOUNT_PROVIDERS = ['password', 'google'] as const;
export type AccountAuthProvider = (typeof AUTH_ACCOUNT_PROVIDERS)[number];

@Schema({ timestamps: false, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  /** Present when the user can sign in with email + password. Omitted for Google-only customers. */
  @Prop({ required: false })
  passwordHash?: string;

  @Prop({ required: true, enum: USER_ROLES, default: 'customer' })
  role: UserRole;

  /**
   * Declared sign-in methods. When missing/empty, password login is allowed iff `passwordHash` is set (legacy rows).
   */
  @Prop({ type: [String], enum: AUTH_ACCOUNT_PROVIDERS, default: undefined })
  authProviders?: AccountAuthProvider[];

  /** Google OIDC `sub` — unique per Google account for lookup/linking. */
  @Prop({ required: false, trim: true })
  googleSubject?: string;

  /** Last known `email_verified` from Google (OAuth phase). */
  @Prop({ required: false })
  googleEmailVerified?: boolean;

  /** Customer Google profile (`given_name`) — updated on each successful Google sign-in. */
  @Prop({ required: false, trim: true })
  firstName?: string;

  /** Customer Google profile (`family_name`) — updated on each successful Google sign-in. */
  @Prop({ required: false, trim: true })
  lastName?: string;

  /** Customer Google profile picture URL — updated on each successful Google sign-in. */
  @Prop({ required: false, trim: true })
  picture?: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ googleSubject: 1 }, { unique: true, sparse: true });
