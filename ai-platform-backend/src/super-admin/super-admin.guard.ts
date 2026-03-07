import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { SuperAdminAuthService } from './super-admin-auth.service';

const COOKIE_NAME = 'sa_token';

function getCookieFromHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((s) => s.trim());
  for (const part of parts) {
    const [name, ...valueParts] = part.split('=');
    if (name?.trim() === COOKIE_NAME && valueParts.length > 0) {
      return valueParts.join('=').trim();
    }
  }
  return null;
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly authService: SuperAdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const cookieHeader = request.headers.cookie;
    const token = getCookieFromHeader(cookieHeader);
    if (!token) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    const user = await this.authService.getAuthenticatedUser(token);
    if (!user) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    (request as unknown as { superAdminUser?: unknown }).superAdminUser = user;
    return true;
  }
}
