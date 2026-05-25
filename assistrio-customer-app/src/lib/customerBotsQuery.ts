import type { WorkspaceMemberRole } from '../api/types';
import { isWorkspaceMemberOnlyRole } from './workspaceRoles';

export type CustomerBotsListQuery = {
  workspaceId?: string;
  status?: 'draft' | 'published' | 'all';
};

/** Build GET /api/customer/bots query params for the active workspace. */
export function buildCustomerBotsListQuery(input: {
  activeWorkspaceId: string | null;
  status?: 'draft' | 'published' | 'all';
}): CustomerBotsListQuery | null {
  const workspaceId = input.activeWorkspaceId?.trim();
  if (!workspaceId) return null;
  const query: CustomerBotsListQuery = { workspaceId };
  if (input.status && input.status !== 'all') {
    query.status = input.status;
  }
  return query;
}

/** Whether legacy onboarding fallback should fetch workspace-scoped bots. */
export function shouldFetchBotsForOnboardingHeuristic(input: {
  role: WorkspaceMemberRole | null;
  onboardingStatus: string | null | undefined;
}): boolean {
  if (isWorkspaceMemberOnlyRole(input.role)) return false;
  if (input.onboardingStatus === 'completed') return false;
  if (
    input.onboardingStatus === 'live_pending_install' ||
    input.onboardingStatus === 'in_progress' ||
    input.onboardingStatus === 'not_started'
  ) {
    return false;
  }
  if (input.onboardingStatus != null) return false;
  return true;
}
