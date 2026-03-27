import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';

const COOKIE_NAME = 'user_token';

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

/** Attached to request after guard runs. No role restriction — any authenticated user. */
export interface RequestUser {
  _id: unknown;
  email: string;
  role: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

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
    const u = user as unknown as { _id: unknown; email: string; role: string };
    (request as unknown as { user?: RequestUser }).user = {
      _id: u._id,
      email: u.email,
      role: u.role,
    };
    return true;
  }
}
