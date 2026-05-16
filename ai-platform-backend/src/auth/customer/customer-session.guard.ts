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
import { getCustomerSessionTokenFromCookieHeader } from '../shared/session-cookie.read';

/**
 * **Customer browser session** — only `ar_customer_session`. Never reads `ar_admin_session`.
 *
 * @see AdminSessionAuthGuard
 */
@Injectable()
export class CustomerSessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const cookieHeader = request.headers.cookie;
    const customerToken = getCustomerSessionTokenFromCookieHeader(cookieHeader);

    if (!customerToken) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    const user = await this.authService.getAuthenticatedUser(customerToken);
    if (!user) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    const role = (user as unknown as { role?: string }).role;
    if (role !== 'customer') {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }
    attachRequestUser(request, user as unknown as User);
    return true;
  }
}
