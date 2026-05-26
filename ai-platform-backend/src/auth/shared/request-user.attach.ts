import type { FastifyRequest } from 'fastify';
import type { User } from '../../models';
import type { RequestUser } from './request-user.types';

export function attachRequestUser(request: FastifyRequest, user: User): void {
  const u = user as unknown as { _id: unknown; email: string; role: string };
  (request as unknown as { user?: RequestUser }).user = {
    _id: u._id,
    email: u.email,
    role: u.role,
    firstName: user.firstName,
    lastName: user.lastName,
    picture: user.picture,
    displayNameOverride: user.displayNameOverride,
    pictureOverride: user.pictureOverride,
    profileLinks: user.profileLinks,
  };
}
