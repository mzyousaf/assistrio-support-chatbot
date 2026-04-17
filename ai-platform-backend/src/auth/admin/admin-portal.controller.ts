import {
  Body,
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
import type { UserRole } from '../../models';
import { AdminSessionAuthGuard } from './admin-session.guard';
import {
  applySetCookieHeaders,
  buildSessionClearCookieHeader,
  buildSessionSetCookieHeader,
  getCookieSecuritySuffix,
} from '../shared/auth-cookie.util';
import { AuthService } from '../shared/auth.service';
import type { RequestUser } from '../shared/request-user.types';
import {
  AR_ADMIN_SESSION_COOKIE_NAME,
  LEGACY_USER_SESSION_COOKIE_NAME,
} from '../shared/session-cookie.constants';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function parseLoginBody(body: unknown): { email: string; password: string } | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const email = typeof o.email === 'string' ? o.email.trim() : '';
  const password = typeof o.password === 'string' ? o.password : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(email) || !password) return null;
  return { email, password };
}

@Controller('api/admin')
export class AdminPortalController {
  constructor(
    private readonly authService: AuthService,
    private readonly workspacesService: WorkspacesService,
    private readonly configService: ConfigService,
  ) {}

  @Post('auth/login')
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: false }) reply: FastifyReply,
  ) {
    const parsed = parseLoginBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.authService.validatePasswordLogin(parsed.email, parsed.password);
    if (result.kind === 'password_auth_not_available') {
      throw new HttpException(
        { error: result.message, errorCode: result.errorCode },
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (result.kind === 'invalid_credentials') {
      throw new HttpException(
        { error: 'Invalid credentials' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const user = result.user;
    const u = user as unknown as { _id: unknown; role: string };
    const role = u.role as UserRole;
    if (role !== 'superadmin') {
      throw new ForbiddenException({
        error: 'Only platform administrators may use admin sign-in.',
        errorCode: 'ADMIN_LOGIN_FORBIDDEN',
      });
    }
    await this.workspacesService.ensurePersonalWorkspaceForUser(String(u._id));
    const token = this.authService.signAdminSessionToken(String(u._id), role);
    const securitySuffix = getCookieSecuritySuffix(
      request,
      this.configService.get<string>('nodeEnv'),
    );
    /** Admin login sets the staff cookie only. */
    applySetCookieHeaders(reply, [
      buildSessionSetCookieHeader(
        AR_ADMIN_SESSION_COOKIE_NAME,
        token,
        SESSION_MAX_AGE_SECONDS,
        securitySuffix,
      ),
    ]);
    return reply.send({ success: true });
  }

  @Post('auth/logout')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: false }) reply: FastifyReply) {
    const securitySuffix = getCookieSecuritySuffix(
      request,
      this.configService.get<string>('nodeEnv'),
    );
    /** Clear staff cookie and legacy `user_token` (often used for admin during migration). */
    applySetCookieHeaders(reply, [
      buildSessionClearCookieHeader(AR_ADMIN_SESSION_COOKIE_NAME, securitySuffix),
      buildSessionClearCookieHeader(LEGACY_USER_SESSION_COOKIE_NAME, securitySuffix),
    ]);
    return reply.send({ success: true });
  }

  @Get('me')
  @UseGuards(AdminSessionAuthGuard)
  async me(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    if (user.role !== 'superadmin') {
      throw new ForbiddenException({
        error: 'Admin session required.',
        errorCode: 'ADMIN_SESSION_REQUIRED',
      });
    }
    await this.workspacesService.ensurePersonalWorkspaceForUser(String(user._id));
    const workspaceIds = await this.workspacesService.getWorkspaceIdsForUser(String(user._id));
    return {
      id: String(user._id),
      email: user.email,
      role: user.role,
      workspaceIds: workspaceIds.map((id) => String(id)),
    };
  }
}
