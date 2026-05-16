import type { UserRole } from '../models';

const MAX_WORKSPACE_NAME_LEN = 120;

/**
 * Shared naming for the user's first personal workspace (superadmin vs customer).
 */
export function resolvePersonalWorkspaceDisplayName(params: {
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  if (params.role === 'superadmin') {
    return 'Assistrio Admin Workspace';
  }
  const fn = String(params.firstName ?? '').trim();
  const ln = String(params.lastName ?? '').trim();
  if (fn && ln) {
    const s = `${fn} ${ln}'s Workspace`;
    return s.length <= MAX_WORKSPACE_NAME_LEN ? s : s.slice(0, MAX_WORKSPACE_NAME_LEN);
  }
  if (fn) {
    const s = `${fn}'s Workspace`;
    return s.length <= MAX_WORKSPACE_NAME_LEN ? s : s.slice(0, MAX_WORKSPACE_NAME_LEN);
  }
  return 'My Workspace';
}
