import { ForbiddenException, GoneException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { Bot } from '../../models';
import { AuthService } from '../shared/auth.service';
import { GoogleOAuthFlowError } from '../shared/google-oauth-flow.error';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { WorkspaceInviteService } from '../../workspaces/workspace-invite.service';
import { CustomerGoogleOAuthService } from './customer-google-oauth.service';

describe('CustomerGoogleOAuthService invite flow', () => {
  const config = {
    googleOauthClientId: 'client',
    googleOauthClientSecret: 'secret',
    googleOauthRedirectUri: 'https://api.example.com/api/customer/auth/google/callback',
    customerAppBaseUrl: 'http://localhost:3002',
    jwtSecret: 'test-secret',
  };

  function createService(deps?: {
    jwtVerify?: (token: string) => unknown;
    jwtSign?: (payload: unknown) => string;
    acceptInvite?: jest.Mock;
    findOrLink?: jest.Mock;
    ensurePersonalWorkspace?: jest.Mock;
    countBots?: jest.Mock;
  }) {
    const jwtService = {
      sign: jest.fn((payload: unknown) => {
        if (deps?.jwtSign) return deps.jwtSign(payload);
        return `signed:${JSON.stringify(payload)}`;
      }),
      verify: jest.fn((token: string) => {
        if (deps?.jwtVerify) return deps.jwtVerify(token);
        return JSON.parse(token.replace(/^signed:/, ''));
      }),
    } as unknown as JwtService;

    const authService = {
      findOrLinkCustomerFromGoogleIdentity:
        deps?.findOrLink ??
        jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', role: 'customer' }),
      signCustomerSessionToken: jest.fn().mockReturnValue('session-jwt'),
    } as unknown as AuthService;

    const workspacesService = {
      ensurePersonalWorkspaceForUser: deps?.ensurePersonalWorkspace ?? jest.fn().mockResolvedValue(undefined),
      getWorkspaceIdsForUser: jest.fn().mockResolvedValue([]),
    } as unknown as WorkspacesService;

    const workspaceInviteService = {
      acceptInviteForUser: deps?.acceptInvite ?? jest.fn().mockResolvedValue({ workspaceId: 'ws-invited' }),
    } as unknown as WorkspaceInviteService;

    const botModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: deps?.countBots ?? jest.fn().mockResolvedValue(0) }),
    } as unknown as Model<Bot>;

    const configService = {
      get: jest.fn((key: string) => config[key as keyof typeof config] ?? ''),
    } as unknown as ConfigService;

    const service = new CustomerGoogleOAuthService(
      configService,
      jwtService,
      authService,
      workspacesService,
      workspaceInviteService,
      botModel,
    );

    return { service, jwtService, authService, workspaceInviteService, botModel };
  }

  it('createStateToken embeds inviteToken in signed payload', () => {
    const { service, jwtService } = createService();
    service.createStateToken({ inviteToken: 'invite-plain-token' });
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        typ: 'google_oauth_csrf',
        v: 1,
        inviteToken: 'invite-plain-token',
      }),
      { expiresIn: '10m' },
    );
  });

  it('parseStateToken returns inviteToken when present', () => {
    const { service } = createService({
      jwtVerify: () => ({ typ: 'google_oauth_csrf', v: 1, inviteToken: 'abc' }),
    });
    expect(service.parseStateToken('state')).toEqual({ inviteToken: 'abc' });
  });

  it('completeSignInFromCallback auto-accepts invite and redirects to /bots', async () => {
    const acceptInvite = jest.fn().mockResolvedValue({ workspaceId: '507f1f77bcf86cd799439012' });
    const { service, workspaceInviteService } = createService({
      jwtVerify: () => ({ typ: 'google_oauth_csrf', v: 1, inviteToken: 'invite-token' }),
      acceptInvite,
      findOrLink: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', role: 'customer' }),
    });

    jest.spyOn(service, 'exchangeAuthorizationCode').mockResolvedValue({ access_token: 'access' });
    jest.spyOn(service, 'fetchGoogleUserInfo').mockResolvedValue({
      sub: 'google-sub',
      email: 'guest@example.com',
      email_verified: true,
    });

    const result = await service.completeSignInFromCallback({
      code: 'auth-code',
      state: 'signed-state',
    });

    expect(workspaceInviteService.acceptInviteForUser).toHaveBeenCalledWith(
      'invite-token',
      '507f1f77bcf86cd799439011',
      'guest@example.com',
    );
    expect(result.redirectUrl).toBe('http://localhost:3002/bots');
    expect(result.customerSessionJwt).toBe('session-jwt');
  });

  it('completeSignInFromCallback redirects to invite error on email mismatch', async () => {
    const { service } = createService({
      jwtVerify: () => ({ typ: 'google_oauth_csrf', v: 1, inviteToken: 'invite-token' }),
      acceptInvite: jest.fn().mockRejectedValue(
        new ForbiddenException({
          message: 'Signed-in email does not match the invited email.',
          errorCode: 'workspace_invite_email_mismatch',
        }),
      ),
    });

    jest.spyOn(service, 'exchangeAuthorizationCode').mockResolvedValue({ access_token: 'access' });
    jest.spyOn(service, 'fetchGoogleUserInfo').mockResolvedValue({
      sub: 'google-sub',
      email: 'wrong@example.com',
      email_verified: true,
    });

    const result = await service.completeSignInFromCallback({
      code: 'auth-code',
      state: 'signed-state',
    });

    expect(result.redirectUrl).toContain('/invite/invite-token');
    expect(result.redirectUrl).toContain('error=workspace_invite_email_mismatch');
    expect(result.customerSessionJwt).toBe('session-jwt');
  });

  it('completeSignInFromCallback without invite uses existing onboarding redirect', async () => {
    const { service, workspaceInviteService } = createService({
      jwtVerify: () => ({ typ: 'google_oauth_csrf', v: 1 }),
      countBots: jest.fn().mockResolvedValue(0),
    });

    jest.spyOn(service, 'exchangeAuthorizationCode').mockResolvedValue({ access_token: 'access' });
    jest.spyOn(service, 'fetchGoogleUserInfo').mockResolvedValue({
      sub: 'google-sub',
      email: 'owner@example.com',
      email_verified: true,
    });
    jest.spyOn(service, 'countBotsInMemberWorkspaces').mockResolvedValue(0);

    const result = await service.completeSignInFromCallback({
      code: 'auth-code',
      state: 'signed-state',
    });

    expect(workspaceInviteService.acceptInviteForUser).not.toHaveBeenCalled();
    expect(result.redirectUrl).toBe('http://localhost:3002/onboarding');
  });

  it('parseStateToken throws invalid_state for bad token', () => {
    const { service } = createService({
      jwtVerify: () => {
        throw new Error('bad');
      },
    });
    expect(() => service.parseStateToken('bad')).toThrow(GoogleOAuthFlowError);
  });

  it('buildCustomerInviteErrorRedirect encodes token and error', () => {
    const { service } = createService();
    const url = service.buildCustomerInviteErrorRedirect('tok/en', 'workspace_invite_expired');
    expect(url).toContain('/invite/tok%2Fen');
    expect(url).toContain('error=workspace_invite_expired');
  });
});
