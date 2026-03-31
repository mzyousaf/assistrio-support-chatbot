import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthGuard, type RequestUser } from './auth.guard';
import { AuthService } from './auth.service';
import type { UserRole } from '../models';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function isCrossSiteRequest(request: FastifyRequest): boolean {
  const originHeader = request.headers.origin;
  const hostHeader = request.headers.host;
  if (!originHeader || !hostHeader) return false;
  try {
    const originHost = new URL(originHeader).host;
    return originHost !== hostHeader;
  } catch {
    return false;
  }
}

function getCookieSecuritySuffix(
  request: FastifyRequest,
  nodeEnv: string | undefined,
): string {
  const isProduction = nodeEnv === 'production';
  const crossSite = isCrossSiteRequest(request);
  const sameSite = crossSite ? 'None' : 'Lax';
  const secure = isProduction || crossSite;
  return `HttpOnly; SameSite=${sameSite}` + (secure ? '; Secure' : '');
}

function parseLoginBody(body: unknown): { email: string; password: string } | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const email = typeof o.email === 'string' ? o.email.trim() : '';
  const password = typeof o.password === 'string' ? o.password : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(email) || !password) return null;
  return { email, password };
}

@Controller('api/user')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly workspacesService: WorkspacesService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
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
    const user = await this.authService.validateCredentials(parsed.email, parsed.password);
    if (!user) {
      throw new HttpException(
        { error: 'Invalid credentials' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const u = user as unknown as { _id: unknown; role: string };
    await this.workspacesService.ensurePersonalWorkspaceForUser(String(u._id));
    const token = this.authService.signToken(String(u._id), u.role as UserRole);
    const maxAge = 60 * 60 * 24 * 7;
    const securitySuffix = getCookieSecuritySuffix(
      request,
      this.configService.get<string>('nodeEnv'),
    );
    const cookie =
      `user_token=${encodeURIComponent(token)}; Path=/; ${securitySuffix}; Max-Age=${maxAge}`;
    reply.header('Set-Cookie', cookie);
    return reply.send({ success: true });
  }

  @Post('logout')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: false }) reply: FastifyReply) {
    const securitySuffix = getCookieSecuritySuffix(
      request,
      this.configService.get<string>('nodeEnv'),
    );
    reply.header('Set-Cookie', `user_token=; Path=/; Max-Age=0; ${securitySuffix}`);
    return reply.send({ success: true });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
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
