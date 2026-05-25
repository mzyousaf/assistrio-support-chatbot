import type { CustomerMe } from '../api/types';
import { isWorkspaceManagerRole } from './workspaceRoles';
import { resolveActiveCustomerWorkspace } from './resolveActiveCustomerWorkspace';

/** Whether the active workspace role may create/edit/delete/publish bots (owner or admin). */
export function canManageActiveWorkspace(customer: CustomerMe | null | undefined): boolean {
  const { role } = resolveActiveCustomerWorkspace(customer ?? null);
  return isWorkspaceManagerRole(role);
}
