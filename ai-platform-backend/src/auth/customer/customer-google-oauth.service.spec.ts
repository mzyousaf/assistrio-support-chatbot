import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { Bot } from '../../models';
import { AuthService } from '../shared/auth.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { CustomerGoogleOAuthService } from './customer-google-oauth.service';

describe('CustomerGoogleOAuthService', () => {
  function createService(config: Record<string, string>): CustomerGoogleOAuthService {
    const configService = {
      get: jest.fn((key: string) => config[key] ?? ''),
    } as unknown as ConfigService;

    return new CustomerGoogleOAuthService(
      configService,
      {} as JwtService,
      {} as AuthService,
      {} as WorkspacesService,
      {} as import('../../workspaces/workspace-invite.service').WorkspaceInviteService,
      {} as Model<Bot>,
    );
  }

  describe('buildGoogleAuthorizeUrl', () => {
    const oauthConfig = {
      googleOauthClientId: 'test-client-id',
      googleOauthRedirectUri: 'https://api.example.com/api/customer/auth/google/callback',
    };

    function expectBaseOAuthParams(parsed: URL, state: string) {
      expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(parsed.searchParams.get('client_id')).toBe(oauthConfig.googleOauthClientId);
      expect(parsed.searchParams.get('redirect_uri')).toBe(oauthConfig.googleOauthRedirectUri);
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('openid email profile');
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(parsed.searchParams.get('access_type')).toBe('online');
      expect(parsed.searchParams.get('include_granted_scopes')).toBe('true');
      expect(parsed.searchParams.get('prompt')).not.toBe('consent');
    }

    it('omits prompt by default and preserves existing OAuth params', () => {
      const service = createService(oauthConfig);
      const state = 'signed-csrf-state';
      const parsed = new URL(service.buildGoogleAuthorizeUrl(state));

      expectBaseOAuthParams(parsed, state);
      expect(parsed.searchParams.has('prompt')).toBe(false);
    });

    it('includes prompt=select_account when selectAccount is true', () => {
      const service = createService(oauthConfig);
      const state = 'signed-csrf-state';
      const parsed = new URL(service.buildGoogleAuthorizeUrl(state, true));

      expectBaseOAuthParams(parsed, state);
      expect(parsed.searchParams.get('prompt')).toBe('select_account');
    });
  });
});
