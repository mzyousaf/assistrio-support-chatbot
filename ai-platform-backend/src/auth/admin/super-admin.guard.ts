import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import type { RequestUser } from '../shared/request-user.types';

/**
 * Requires a prior guard that sets `request.user` (typically {@link AdminSessionAuthGuard} on staff-only routes).
 * Only `superadmin` may proceed.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      FastifyRequest & { user?: RequestUser }
    >();
    const role = request.user?.role;
    if (role !== 'superadmin') {
      throw new ForbiddenException({
        error: 'This action requires a superadmin account.',
        errorCode: 'SUPERADMIN_ONLY',
      });
    }
    return true;
  }
}
