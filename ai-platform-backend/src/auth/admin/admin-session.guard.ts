import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import type { User } from '../../models';
import { AuthService } from '../shared/auth.service';
import { attachRequestUser } from '../shared/request-user.attach';
import { getAdminSessionTokenFromCookieHeader } from '../shared/session-cookie.read';

/**
 * **Staff browser session** — only `ar_admin_session`. Never reads `ar_customer_session`.
 *
 * @see CustomerSessionAuthGuard
 */
@Injectable()
export class AdminSessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const cookieHeader = request.headers.cookie;
    const adminToken = getAdminSessionTokenFromCookieHeader(cookieHeader);

    if (!adminToken) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    const user = await this.authService.getAuthenticatedUser(adminToken);
    if (!user) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    const role = (user as unknown as { role?: string }).role;
    if (role !== 'superadmin') {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    attachRequestUser(request, user as unknown as User);
    return true;
  }
}
