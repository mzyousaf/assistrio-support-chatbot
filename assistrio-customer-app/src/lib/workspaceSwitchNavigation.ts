import type { CustomerMe } from '../api/types';
import { CUSTOMER_ROUTES } from '../routes/customerRoutes';
import { isWorkspaceMemberOnlyRole } from './workspaceRoles';
import { resolveActiveCustomerWorkspace } from './resolveActiveCustomerWorkspace';

/** Navbar label: active workspace name only. */
export function activeWorkspaceNavbarLabel(customer: CustomerMe | null): string {
  if (!customer) return 'My workspace';
  const active = resolveActiveCustomerWorkspace(customer).workspace;
  if (active?.name?.trim()) return active.name.trim();
  const list = customer.workspaces;
  if (list && list.length === 1) return list[0].name?.trim() || 'My workspace';
  const fn = customer.firstName?.trim();
  const ln = customer.lastName?.trim();
  if (fn && ln) return `${fn} ${ln}'s workspace`;
  if (fn) return `${fn}'s workspace`;
  return 'My workspace';
}

/** Post-switch destination based on active workspace role and onboarding status. */
export function resolvePathAfterWorkspaceSwitch(customer: CustomerMe): string {
  const { role, onboardingStatus } = resolveActiveCustomerWorkspace(customer);
  if (isWorkspaceMemberOnlyRole(role)) return CUSTOMER_ROUTES.agents;
  if (onboardingStatus === 'completed') return CUSTOMER_ROUTES.agents;
  return CUSTOMER_ROUTES.onboarding;
}
