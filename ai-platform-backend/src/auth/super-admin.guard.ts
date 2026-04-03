import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import type { RequestUser } from './auth.guard';

/**
 * Requires {@link AuthGuard} to run first so `request.user` is set.
 * Only users with role `superadmin` may proceed.
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
