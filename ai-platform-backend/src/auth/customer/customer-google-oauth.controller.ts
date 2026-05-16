import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  applySetCookieHeaders,
  buildSessionSetCookieHeader,
  getCookieSecuritySuffix,
} from '../shared/auth-cookie.util';
import { CustomerGoogleOAuthService } from './customer-google-oauth.service';
import { GoogleOAuthFlowError } from '../shared/google-oauth-flow.error';
import { AR_CUSTOMER_SESSION_COOKIE_NAME } from '../shared/session-cookie.constants';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Customer-only Google OAuth. Admin/staff must not use these routes.
 *
 * Session: sets `ar_customer_session` only — never `user_token` or `ar_admin_session`.
 */
@Controller('api/customer/auth/google')
export class CustomerGoogleOAuthController {
  constructor(
    private readonly googleOauth: CustomerGoogleOAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Starts OAuth: redirects browser to Google with signed `state` (JWT, short-lived).
   */
  @Get()
  async start(@Req() request: FastifyRequest, @Res({ passthrough: false }) reply: FastifyReply) {
    if (!this.googleOauth.isConfigured()) {
      const loc = this.googleOauth.buildCustomerErrorRedirect('oauth_not_configured');
      return reply.redirect(302, loc);
    }
    const state = this.googleOauth.createStateToken();
    const url = this.googleOauth.buildGoogleAuthorizeUrl(state);
    return reply.redirect(302, url);
  }

  /**
   * Google redirects here with `code` and `state`. Validates CSRF state, exchanges code, issues session.
   */
  @Get('callback')
  async callback(
    @Req() request: FastifyRequest,
    @Res({ passthrough: false }) reply: FastifyReply,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') googleError: string | undefined,
  ) {
    try {
      const { customerSessionJwt, redirectUrl } = await this.googleOauth.completeSignInFromCallback({
        code,
        state,
        googleError,
      });
      const securitySuffix = getCookieSecuritySuffix(
        request,
        this.configService.get<string>('nodeEnv'),
      );
      /**
       * Customer Google login uses only `ar_customer_session` — not legacy `user_token`
       * (legacy remains for password login / migration).
       */
      applySetCookieHeaders(reply, [
        buildSessionSetCookieHeader(
          AR_CUSTOMER_SESSION_COOKIE_NAME,
          customerSessionJwt,
          SESSION_MAX_AGE_SECONDS,
          securitySuffix,
        ),
      ]);
      return reply.redirect(302, redirectUrl);
    } catch (e) {
      if (e instanceof GoogleOAuthFlowError) {
        const loc = this.googleOauth.buildCustomerErrorRedirect(e.code);
        return reply.redirect(302, loc);
      }
      console.error('Google OAuth callback failed', e);
      const loc = this.googleOauth.buildCustomerErrorRedirect('token_exchange_failed');
      return reply.redirect(302, loc);
    }
  }

  /**
   * Explicit health for misconfigured routing — optional; avoids opaque 404 during setup.
   */
  @Get('status')
  status() {
    if (!this.googleOauth.isConfigured()) {
      throw new HttpException(
        {
          error: 'Google OAuth is not configured',
          errorCode: 'OAUTH_NOT_CONFIGURED',
          requiredEnv: [
            'GOOGLE_OAUTH_CLIENT_ID',
            'GOOGLE_OAUTH_CLIENT_SECRET',
            'GOOGLE_OAUTH_REDIRECT_URI',
            'CUSTOMER_APP_BASE_URL',
          ],
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { ok: true, message: 'Google OAuth is configured for customer sign-in.' };
  }
}
