import type { WorkspacesService } from '../../workspaces/workspaces.service';
import type { RequestUser } from '../shared/request-user.types';

/** Safe customer session body returned by `GET /api/customer/me` and `GET /api/customer/auth/session`. */
export type CustomerSessionPayload = {
  id: string;
  email: string;
  role: string;
  workspaceIds: string[];
  workspaces: Array<{ id: string; name: string }>;
  firstName?: string;
  lastName?: string;
  picture?: string;
};

/**
 * Replace client-side onboarding heuristic with workspace onboarding state in onboarding epic.
 * `needsOnboarding` is intentionally omitted until workspace onboarding fields exist.
 * `activeWorkspaceId` is deferred to workspace switcher / invite epic.
 */
export async function buildCustomerSessionPayload(
  user: RequestUser,
  workspacesService: WorkspacesService,
): Promise<CustomerSessionPayload> {
  const userId = String(user._id);
  await workspacesService.ensurePersonalWorkspaceForUser(userId);
  const workspaceIds = await workspacesService.getWorkspaceIdsForUser(userId);
  const workspaces = await workspacesService.getWorkspacesSummaryForUser(userId);
  return {
    id: userId,
    email: user.email,
    role: user.role,
    workspaceIds: workspaceIds.map((id) => String(id)),
    workspaces,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    picture: user.picture ?? undefined,
  };
}
