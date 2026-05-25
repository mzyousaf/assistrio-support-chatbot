import type { CustomerMe, CustomerWorkspaceSummary, WorkspaceOnboardingStatus } from '../api/types';
import { isWorkspaceMemberOnlyRole } from './workspaceRoles';

export type ResolvedActiveCustomerWorkspace = {
  activeWorkspaceId: string | null;
  workspace: CustomerWorkspaceSummary | null;
  role: CustomerWorkspaceSummary['role'] | null;
  onboardingStatus: WorkspaceOnboardingStatus | null | undefined;
};

/** Resolve the active workspace from customer session (`activeWorkspaceId` with fallback). */
export function resolveActiveCustomerWorkspace(
  customer: CustomerMe | null,
): ResolvedActiveCustomerWorkspace {
  if (!customer) {
    return {
      activeWorkspaceId: null,
      workspace: null,
      role: null,
      onboardingStatus: null,
    };
  }

  const workspaces = customer.workspaces ?? [];
  const storedActiveId = customer.activeWorkspaceId?.trim() || null;
  const workspace =
    (storedActiveId ? workspaces.find((row) => row.id === storedActiveId) : null) ??
    workspaces[0] ??
    null;

  return {
    activeWorkspaceId: workspace?.id ?? storedActiveId,
    workspace: workspace ?? null,
    role: workspace?.role ?? null,
    onboardingStatus: workspace?.onboardingStatus,
  };
}

export type LegacyOnboardingHeuristic = {
  setupFinished: boolean;
  publishedCount: number;
};

/** Whether the active workspace requires owner/admin onboarding. Invited members always bypass. */
export function computeNeedsOnboardingForCustomer(
  customer: CustomerMe | null,
  legacy?: LegacyOnboardingHeuristic,
): boolean {
  if (!customer) return false;

  const { workspace, role, onboardingStatus } = resolveActiveCustomerWorkspace(customer);
  if (!workspace) {
    if (!legacy) return false;
    return !legacy.setupFinished && legacy.publishedCount === 0;
  }

  if (isWorkspaceMemberOnlyRole(role)) return false;

  if (onboardingStatus === 'completed') return false;
  if (
    onboardingStatus === 'live_pending_install' ||
    onboardingStatus === 'in_progress' ||
    onboardingStatus === 'not_started'
  ) {
    return true;
  }
  if (onboardingStatus != null) return true;

  if (legacy) return !legacy.setupFinished && legacy.publishedCount === 0;
  return false;
}
