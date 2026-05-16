import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  applySetCookieHeaders,
  buildSessionClearCookieHeader,
  getCookieSecuritySuffix,
} from '../shared/auth-cookie.util';
import type { RequestUser } from '../shared/request-user.types';
import { CustomerSessionAuthGuard } from './customer-session.guard';
import { AR_CUSTOMER_SESSION_COOKIE_NAME } from '../shared/session-cookie.constants';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/**
 * Customer account surface at `/api/customer` (me, logout). Workspace product APIs live under
 * `/api/customer/bots/*` (see `workspace/customer-bots.controller.ts`).
 */
@Controller('api/customer')
export class CustomerPortalController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly configService: ConfigService,
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
    applySetCookieHeaders(reply, [
      buildSessionClearCookieHeader(AR_CUSTOMER_SESSION_COOKIE_NAME, securitySuffix),
    ]);
    return reply.send({ success: true });
  }

  @Get('me')
  @UseGuards(CustomerSessionAuthGuard)
  async me(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        error: 'Customer session required.',
        errorCode: 'CUSTOMER_SESSION_REQUIRED',
      });
    }
    await this.workspacesService.ensurePersonalWorkspaceForUser(String(user._id));
    const workspaceIds = await this.workspacesService.getWorkspaceIdsForUser(String(user._id));
    const workspaces = await this.workspacesService.getWorkspacesSummaryForUser(String(user._id));
    return {
      id: String(user._id),
      email: user.email,
      role: user.role,
      workspaceIds: workspaceIds.map((id) => String(id)),
      workspaces,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      picture: user.picture ?? undefined,
    };
  }
}
