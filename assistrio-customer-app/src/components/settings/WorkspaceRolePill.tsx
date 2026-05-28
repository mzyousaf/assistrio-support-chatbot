import type { WorkspaceInviteRole, WorkspaceMemberRole } from '@/api/types';
import { cn } from '@/lib/utils';
import { workspaceRoleLabel, workspaceRolePillClassName } from '@/lib/workspaceRoles';

type Props = {
  role: WorkspaceMemberRole | WorkspaceInviteRole;
};

export function WorkspaceRolePill({ role }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        workspaceRolePillClassName(role),
      )}
    >
      {workspaceRoleLabel(role)}
    </span>
  );
}
