import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { WorkspaceEntitlementsService } from '../../entitlements/workspace-entitlements.service';
import {
  applySetCookieHeaders,
  buildSessionClearCookieHeader,
  getCookieSecuritySuffix,
} from '../shared/auth-cookie.util';
import type { RequestUser } from '../shared/request-user.types';
import { CustomerSessionAuthGuard } from './customer-session.guard';
import { buildCustomerSessionPayload } from './customer-session.payload';
import { CustomerProfileService } from './customer-profile.service';
import { parseCustomerAvatarMultipartUpload } from './customer-profile-avatar.util';
import { parsePatchCustomerProfileBody } from './customer-profile.validation';
import { AR_CUSTOMER_SESSION_COOKIE_NAME } from '../shared/session-cookie.constants';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/**
 * Customer account surface at `/api/customer` (session, me, logout). Workspace product APIs live under
 * `/api/customer/bots/*` (see `workspace/customer-bots.controller.ts`).
 */
@Controller('api/customer')
export class CustomerPortalController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly configService: ConfigService,
    private readonly customerProfileService: CustomerProfileService,
  ) {}

  /**
   * Clears the customer session cookie only. Does not clear `ar_admin_session` so a staff session in the same browser is unaffected.
   */
  @Post('auth/logout')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: false }) reply: FastifyReply) {
    const securitySuffix = getCookieSecuritySuffix(
      request,
      this.configService.get<string>('nodeEnv'),
    );
    const sessionCookieDomain = this.configService.get<string>('sessionCookieDomain');
    applySetCookieHeaders(reply, [
      buildSessionClearCookieHeader(AR_CUSTOMER_SESSION_COOKIE_NAME, securitySuffix, sessionCookieDomain),
    ]);
    return reply.send({ success: true });
  }

  @Get('me')
  @UseGuards(CustomerSessionAuthGuard)
  async me(@Req() req: RequestWithUser) {
    return this.resolveCustomerSession(req);
  }

  /**
   * Canonical customer browser session probe (same payload as `/me`).
   * Prefer this route for new clients; `/me` remains for backward compatibility.
   */
  @Get('auth/session')
  @UseGuards(CustomerSessionAuthGuard)
  async session(@Req() req: RequestWithUser) {
    return this.resolveCustomerSession(req);
  }

  @Patch('me/profile')
  @UseGuards(CustomerSessionAuthGuard)
  async patchProfile(@Req() req: RequestWithUser, @Body() body: unknown) {
    const user = req.user;
    if (!user) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        error: 'Customer session required.',
        errorCode: 'CUSTOMER_SESSION_REQUIRED',
      });
    }
    const patch = parsePatchCustomerProfileBody(body);
    const customer = await this.customerProfileService.patchProfile(String(user._id), patch);
    return { customer };
  }

  @Post('me/avatar')
  @UseGuards(CustomerSessionAuthGuard)
  async uploadAvatar(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        error: 'Customer session required.',
        errorCode: 'CUSTOMER_SESSION_REQUIRED',
      });
    }
    const file = await parseCustomerAvatarMultipartUpload(req);
    const customer = await this.customerProfileService.uploadAvatar(String(user._id), file);
    return { customer };
  }

  private async resolveCustomerSession(req: RequestWithUser) {
    const user = req.user;
    if (!user) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        error: 'Customer session required.',
        errorCode: 'CUSTOMER_SESSION_REQUIRED',
      });
    }
    return buildCustomerSessionPayload(user, this.workspacesService, this.entitlementsService);
  }
}
