import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  User,
  USER_ROLES,
  type AccountAuthProvider,
  type UserRole,
} from '../../models';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { GoogleOAuthFlowError } from './google-oauth-flow.error';

export type GoogleProfileSyncFields = {
  firstName?: string;
  lastName?: string;
  picture?: string;
};

function googleProfileToDocSet(p?: GoogleProfileSyncFields): Record<string, string> {
  if (!p) return {};
  const o: Record<string, string> = {};
  if (p.firstName !== undefined) o.firstName = p.firstName;
  if (p.lastName !== undefined) o.lastName = p.lastName;
  if (p.picture !== undefined) o.picture = p.picture;
  return o;
}

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

export type PasswordLoginResult =
  | { kind: 'ok'; user: User }
  | { kind: 'invalid_credentials' }
  | {
      kind: 'password_auth_not_available';
      message: string;
      errorCode: 'PASSWORD_AUTH_NOT_AVAILABLE';
    };

/** Map legacy platform roles so existing JWTs keep working after enum change. */
function normalizeTokenRole(role: string): UserRole {
  if (role === 'admin' || role === 'viewer') return 'customer';
  if ((USER_ROLES as readonly string[]).includes(role)) return role as UserRole;
  throw new Error('Invalid role in token');
}

/**
 * Password login is allowed when a bcrypt hash exists and the account is not Google-only.
 * Legacy Mongo rows may omit `authProviders`; they are treated as password-capable when `passwordHash` is set.
 */
export function userHasPasswordCredential(user: {
  passwordHash?: string | null;
  authProviders?: AccountAuthProvider[] | null;
}): boolean {
  const hash = typeof user.passwordHash === 'string' ? user.passwordHash.trim() : '';
  const hasHash = hash.length > 0;
  const providers = user.authProviders;
  const legacyUnspecifiedProviders = providers == null || providers.length === 0;
  const passwordListed =
    legacyUnspecifiedProviders || (providers as AccountAuthProvider[]).includes('password');
  if (!passwordListed) {
    return false;
  }
  return hasHash;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async findUserByEmail(email: string) {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .exec();
  }

  /** Match stable Google `sub` before email-based linking rules. */
  async findUserByGoogleSubject(googleSubject: string): Promise<User | null> {
    const sub = String(googleSubject ?? '').trim();
    if (!sub) return null;
    const doc = await this.userModel.findOne({ googleSubject: sub }).exec();
    return doc ? (doc as unknown as User) : null;
  }

  async countUsers(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  /**
   * Seed / admin-provisioned users: always password-based. Google OAuth must not use this path.
   */
  async createUser(email: string, password: string, role: UserRole) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed)) {
      throw new Error('Invalid email');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const existing = await this.findUserByEmail(trimmed);
    if (existing) {
      throw new Error('User with this email already exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const doc = await this.userModel.create({
      email: trimmed,
      passwordHash,
      role,
      authProviders: ['password'] satisfies AccountAuthProvider[],
    });
    const uid = (doc as unknown as { _id: Types.ObjectId })._id;
    await this.workspacesService.createWorkspaceWithAdminMember(uid);
    return doc;
  }

  /**
   * @deprecated Use {@link signAdminSessionToken} / {@link signCustomerSessionToken} at call sites.
   * Still used internally until all callers are migrated.
   */
  signToken(userId: string, role: UserRole): string {
    return this.signPlatformSessionToken(userId, role);
  }

  /**
   * Session JWT for staff — set only on `ar_admin_session` via `/api/admin/auth/login`.
   */
  signAdminSessionToken(userId: string, role: UserRole): string {
    return this.signPlatformSessionToken(userId, role);
  }

  /**
   * Session JWT for customers after password or (later) Google OAuth. Same shape as admin today.
   */
  signCustomerSessionToken(userId: string, role: UserRole): string {
    return this.signPlatformSessionToken(userId, role);
  }

  private signPlatformSessionToken(userId: string, role: UserRole): string {
    return this.jwtService.sign(
      { sub: userId, role },
      { expiresIn: '7d' },
    );
  }

  verifyToken(token: string): AuthTokenPayload {
    const decoded = this.jwtService.verify<AuthTokenPayload>(token);
    if (typeof decoded?.sub !== 'string' || !decoded.role) {
      throw new Error('Invalid token claims');
    }
    const role = normalizeTokenRole(decoded.role);
    return { sub: decoded.sub, role };
  }

  /**
   * Email + password login. Distinguishes “unknown/bad password” from “Google-only account”.
   */
  async validatePasswordLogin(email: string, password: string): Promise<PasswordLoginResult> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      return { kind: 'invalid_credentials' };
    }
    const uProviders = (user as unknown as { authProviders?: AccountAuthProvider[] }).authProviders;
    const uHash = (user as unknown as { passwordHash?: string }).passwordHash?.trim() ?? '';
    if (
      Array.isArray(uProviders) &&
      uProviders.includes('password') &&
      !uHash
    ) {
      return { kind: 'invalid_credentials' };
    }
    if (!userHasPasswordCredential(user as unknown as Parameters<typeof userHasPasswordCredential>[0])) {
      return {
        kind: 'password_auth_not_available',
        message: 'This account uses Google sign-in. Use Continue with Google.',
        errorCode: 'PASSWORD_AUTH_NOT_AVAILABLE',
      };
    }
    const hash = (user as unknown as { passwordHash?: string }).passwordHash ?? '';
    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return { kind: 'invalid_credentials' };
    }
    return { kind: 'ok', user: user as unknown as User };
  }

  async getAuthenticatedUser(token: string): Promise<User | null> {
    let payload: AuthTokenPayload;
    try {
      payload = this.verifyToken(token);
    } catch {
      return null;
    }
    const user = await this.userModel.findById(payload.sub).exec();
    if (!user) return null;
    return user as unknown as User;
  }

  /**
   * Google OAuth callback only: find by `googleSubject`, link by email for password customers, or create
   * Google-only customer. Conservative — never links to `superadmin`.
   * Profile fields are applied on every successful callback when provided (customer-only callers).
   */
  async findOrLinkCustomerFromGoogleIdentity(params: {
    googleSubject: string;
    email: string;
    emailVerified: boolean;
    googleProfile?: GoogleProfileSyncFields;
  }): Promise<User> {
    const sub = String(params.googleSubject ?? '').trim();
    const emailNorm = String(params.email ?? '').trim().toLowerCase();
    if (!sub) {
      throw new GoogleOAuthFlowError('missing_subject');
    }
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(emailNorm)) {
      throw new GoogleOAuthFlowError('missing_email');
    }

    const bySub = await this.findUserByGoogleSubject(sub);
    if (bySub) {
      const role = (bySub as unknown as { role?: UserRole }).role;
      if (role === 'superadmin') {
        throw new GoogleOAuthFlowError(
          'superadmin_google_login_forbidden',
          'Google sign-in is not available for administrator accounts.',
        );
      }
      if (role !== 'customer') {
        throw new GoogleOAuthFlowError('superadmin_google_login_forbidden');
      }
      const docEmail = String((bySub as unknown as { email?: string }).email ?? '')
        .trim()
        .toLowerCase();
      if (docEmail !== emailNorm) {
        throw new GoogleOAuthFlowError(
          'google_subject_email_mismatch',
          'Google account email does not match the email on file for this sign-in.',
        );
      }
      await this.userModel.updateOne(
        { _id: (bySub as unknown as { _id: Types.ObjectId })._id },
        { $set: { googleEmailVerified: params.emailVerified, ...googleProfileToDocSet(params.googleProfile) } },
      );
      const refreshed = await this.userModel.findById((bySub as unknown as { _id: Types.ObjectId })._id).exec();
      return refreshed as unknown as User;
    }

    const byEmail = await this.findUserByEmail(emailNorm);
    if (byEmail) {
      const role = (byEmail as unknown as { role?: UserRole }).role;
      if (role === 'superadmin') {
        throw new GoogleOAuthFlowError(
          'admin_email_conflict',
          'This email is registered as a platform administrator. Use admin sign-in instead.',
        );
      }
      if (role !== 'customer') {
        throw new GoogleOAuthFlowError('superadmin_google_login_forbidden');
      }

      if (!params.emailVerified) {
        throw new GoogleOAuthFlowError(
          'email_not_verified',
          'Google email must be verified to link this account.',
        );
      }

      const existingSub = String((byEmail as unknown as { googleSubject?: string }).googleSubject ?? '').trim();
      if (existingSub && existingSub !== sub) {
        throw new GoogleOAuthFlowError(
          'email_linked_different_google',
          'This email is already linked to a different Google account.',
        );
      }

      const prevProviders = (byEmail as unknown as { authProviders?: AccountAuthProvider[] }).authProviders ?? [];
      const merged = new Set<AccountAuthProvider>([...prevProviders, 'google']);

      await this.userModel.updateOne(
        { _id: (byEmail as unknown as { _id: Types.ObjectId })._id },
        {
          $set: {
            googleSubject: sub,
            googleEmailVerified: params.emailVerified,
            authProviders: [...merged],
            ...googleProfileToDocSet(params.googleProfile),
          },
        },
      );
      const linked = await this.userModel.findById((byEmail as unknown as { _id: Types.ObjectId })._id).exec();
      return linked as unknown as User;
    }

    if (!params.emailVerified) {
      throw new GoogleOAuthFlowError(
        'email_not_verified',
        'Google email must be verified to create an account.',
      );
    }

    const doc = await this.userModel.create({
      email: emailNorm,
      role: 'customer' as UserRole,
      authProviders: ['google'] satisfies AccountAuthProvider[],
      googleSubject: sub,
      googleEmailVerified: params.emailVerified,
      ...googleProfileToDocSet(params.googleProfile),
    });
    const uid = (doc as unknown as { _id: Types.ObjectId })._id;
    await this.workspacesService.createWorkspaceWithAdminMember(uid);
    return doc as unknown as User;
  }
}
