import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bot } from '../../models';
import { AuthService, type GoogleProfileSyncFields } from '../shared/auth.service';
import { GoogleOAuthFlowError, type GoogleOAuthErrorCode } from '../shared/google-oauth-flow.error';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { WorkspaceInviteService } from '../../workspaces/workspace-invite.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const STATE_JWT_TYP = 'google_oauth_csrf' as const;

type GoogleTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

function pickGoogleProfileFromUserinfo(raw: GoogleUserInfoResponse): GoogleProfileSyncFields | undefined {
  const out: GoogleProfileSyncFields = {};
  if ('given_name' in raw && raw.given_name != null) {
    out.firstName = String(raw.given_name).trim();
  }
  if ('family_name' in raw && raw.family_name != null) {
    out.lastName = String(raw.family_name).trim();
  }
  if ('picture' in raw && raw.picture != null) {
    out.picture = String(raw.picture).trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

@Injectable()
export class CustomerGoogleOAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceInviteService: WorkspaceInviteService,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
  ) {}

  isConfigured(): boolean {
    const c = this.configService.get<string>('googleOauthClientId') ?? '';
    const s = this.configService.get<string>('googleOauthClientSecret') ?? '';
    const r = this.configService.get<string>('googleOauthRedirectUri') ?? '';
    const app = this.configService.get<string>('customerAppBaseUrl') ?? '';
    return Boolean(c && s && r && app);
  }

  createStateToken(options?: { inviteToken?: string }): string {
    const payload: { typ: typeof STATE_JWT_TYP; v: 1; inviteToken?: string } = {
      typ: STATE_JWT_TYP,
      v: 1,
    };
    const inviteToken = String(options?.inviteToken ?? '').trim();
    if (inviteToken) {
      payload.inviteToken = inviteToken;
    }
    return this.jwtService.sign(payload, { expiresIn: '10m' });
  }

  parseStateToken(state: string | undefined): { inviteToken?: string } {
    if (!state?.trim()) {
      throw new GoogleOAuthFlowError('invalid_state');
    }
    try {
      const d = this.jwtService.verify<{ typ?: string; v?: number; inviteToken?: string }>(state.trim());
      if (d.typ !== STATE_JWT_TYP || d.v !== 1) {
        throw new GoogleOAuthFlowError('invalid_state');
      }
      const inviteToken = String(d.inviteToken ?? '').trim();
      return inviteToken ? { inviteToken } : {};
    } catch (e) {
      if (e instanceof GoogleOAuthFlowError) throw e;
      throw new GoogleOAuthFlowError('invalid_state');
    }
  }

  verifyStateToken(state: string | undefined): void {
    this.parseStateToken(state);
  }

  buildGoogleAuthorizeUrl(state: string, selectAccount = false): string {
    const clientId = this.configService.get<string>('googleOauthClientId') ?? '';
    const redirectUri = this.configService.get<string>('googleOauthRedirectUri') ?? '';
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      include_granted_scopes: 'true',
    });
    if (selectAccount) {
      q.set('prompt', 'select_account');
    }
    return `${GOOGLE_AUTH_URL}?${q.toString()}`;
  }

  /** Safe error landing on the customer app (no secrets in query). */
  buildCustomerErrorRedirect(code: GoogleOAuthErrorCode | string): string {
    const base = this.configService.get<string>('customerAppBaseUrl') ?? '';
    const u = new URL('/login', `${base}/`);
    u.searchParams.set('oauth_error', code);
    return u.toString();
  }

  /** Invite accept failure — return user to invite page with machine-readable error. */
  buildCustomerInviteErrorRedirect(inviteToken: string, errorCode: string): string {
    const base = (this.configService.get<string>('customerAppBaseUrl') ?? '').replace(/\/$/, '');
    const u = new URL(`/invite/${encodeURIComponent(inviteToken)}`, `${base}/`);
    u.searchParams.set('error', errorCode);
    return u.toString();
  }

  private buildCustomerAppPathRedirect(path: '/onboarding' | '/dashboard' | '/bots'): string {
    const base = (this.configService.get<string>('customerAppBaseUrl') ?? '').replace(/\/$/, '');
    return `${base}${path}`;
  }

  private buildCustomerSuccessRedirect(path: '/onboarding' | '/dashboard'): string {
    return this.buildCustomerAppPathRedirect(path);
  }

  private extractHttpExceptionErrorCode(err: unknown): string {
    if (!(err instanceof HttpException)) return 'workspace_invite_not_found';
    const response = err.getResponse();
    if (response && typeof response === 'object' && 'errorCode' in response) {
      const code = (response as { errorCode?: unknown }).errorCode;
      if (typeof code === 'string' && code.trim()) return code.trim();
    }
    return 'workspace_invite_not_found';
  }

  async exchangeAuthorizationCode(code: string): Promise<GoogleTokenResponse> {
    const clientId = this.configService.get<string>('googleOauthClientId') ?? '';
    const clientSecret = this.configService.get<string>('googleOauthClientSecret') ?? '';
    const redirectUri = this.configService.get<string>('googleOauthRedirectUri') ?? '';
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new GoogleOAuthFlowError('token_exchange_failed', `Google token HTTP ${res.status}`);
    }
    return (await res.json()) as GoogleTokenResponse;
  }

  async fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfoResponse> {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new GoogleOAuthFlowError('userinfo_failed', `Google userinfo HTTP ${res.status}`);
    }
    return (await res.json()) as GoogleUserInfoResponse;
  }

  /**
   * Bots tied to any workspace the user belongs to. Zero ⇒ first-time product setup ⇒ onboarding.
   * TODO: replace with explicit onboarding flags on User/Workspace when added.
   */
  async countBotsInMemberWorkspaces(userId: string): Promise<number> {
    const wsIds = await this.workspacesService.getWorkspaceIdsForUser(userId);
    if (wsIds.length === 0) return 0;
    return this.botModel.countDocuments({ workspaceId: { $in: wsIds } }).exec();
  }

  /**
   * Full callback: validate, exchange, link user, return customer session JWT + redirect target.
   * Does not set cookies — caller sets `ar_customer_session` only.
   */
  async completeSignInFromCallback(params: {
    code: string | undefined;
    state: string | undefined;
    googleError?: string | undefined;
  }): Promise<{ customerSessionJwt: string; redirectUrl: string }> {
    if (!this.isConfigured()) {
      throw new GoogleOAuthFlowError('oauth_not_configured');
    }
    if (params.googleError) {
      throw new GoogleOAuthFlowError('google_denied', params.googleError);
    }
    const statePayload = this.parseStateToken(params.state);
    const inviteToken = statePayload.inviteToken;
    const code = String(params.code ?? '').trim();
    if (!code) {
      throw new GoogleOAuthFlowError('missing_code');
    }

    const tokens = await this.exchangeAuthorizationCode(code);
    const access = String(tokens.access_token ?? '').trim();
    if (!access) {
      throw new GoogleOAuthFlowError('token_exchange_failed', 'No access_token from Google');
    }

    const raw = await this.fetchGoogleUserInfo(access);
    const sub = String(raw.sub ?? '').trim();
    const email = String(raw.email ?? '').trim();
    const emailVerified = raw.email_verified === true;
    if (!sub) {
      throw new GoogleOAuthFlowError('missing_subject');
    }
    if (!email) {
      throw new GoogleOAuthFlowError('missing_email');
    }

    const googleProfile = pickGoogleProfileFromUserinfo(raw);

    let user;
    try {
      user = await this.authService.findOrLinkCustomerFromGoogleIdentity({
        googleSubject: sub,
        email,
        emailVerified,
        googleProfile,
      });
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? Number((e as { code: unknown }).code) : NaN;
      if (code === 11000) {
        throw new GoogleOAuthFlowError('email_linked_different_google');
      }
      throw e;
    }

    const uid = String((user as unknown as { _id: unknown })._id);
    await this.workspacesService.ensurePersonalWorkspaceForUser(uid);

    const role = (user as unknown as { role: 'customer' }).role;
    const jwt = this.authService.signCustomerSessionToken(uid, role);

    if (inviteToken) {
      try {
        await this.workspaceInviteService.acceptInviteForUser(inviteToken, uid, email);
        return {
          customerSessionJwt: jwt,
          redirectUrl: this.buildCustomerAppPathRedirect('/bots'),
        };
      } catch (e) {
        const errorCode = this.extractHttpExceptionErrorCode(e);
        return {
          customerSessionJwt: jwt,
          redirectUrl: this.buildCustomerInviteErrorRedirect(inviteToken, errorCode),
        };
      }
    }

    const botCount = await this.countBotsInMemberWorkspaces(uid);
    const path: '/onboarding' | '/dashboard' = botCount === 0 ? '/onboarding' : '/dashboard';
    return {
      customerSessionJwt: jwt,
      redirectUrl: this.buildCustomerSuccessRedirect(path),
    };
  }
}
