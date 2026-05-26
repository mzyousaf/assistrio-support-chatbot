import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

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

  /** Customer-edited display name; takes precedence over Google first/last name in session payloads. */
  @Prop({ type: String, default: undefined, trim: true })
  displayNameOverride?: string | null;

  /**
   * Customer-edited profile photo URL. When set (non-empty), overrides Google `picture` in session payloads.
   * Explicit `null` clears a previous override and restores the Google photo.
   */
  @Prop({ type: String, default: undefined, trim: true })
  pictureOverride?: string | null;

  /** Optional public contact links shown on the customer profile (editable in account settings). */
  @Prop({
    type: {
      linkedinUrl: { type: String, default: undefined, trim: true },
      calendlyUrl: { type: String, default: undefined, trim: true },
      websiteUrl: { type: String, default: undefined, trim: true },
      otherUrl: { type: String, default: undefined, trim: true },
    },
    default: undefined,
    _id: false,
  })
  profileLinks?: {
    linkedinUrl?: string | null;
    calendlyUrl?: string | null;
    websiteUrl?: string | null;
    otherUrl?: string | null;
  };

  /** Last selected workspace in the customer app; must match a workspace membership. */
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: false })
  activeWorkspaceId?: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ googleSubject: 1 }, { unique: true, sparse: true });
