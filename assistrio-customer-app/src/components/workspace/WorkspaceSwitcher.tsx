import { forwardRef, useId, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { CustomerMe, CustomerWorkspaceSummary } from '@/api/types';
import { appToast } from '@/lib/app-toast';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import {
  activeWorkspaceNavbarLabel,
  resolvePathAfterWorkspaceSwitch,
} from '@/lib/workspaceSwitchNavigation';
import { cn } from '@/lib/utils';
import {
  workspaceRoleBadgeClassName,
  workspaceRoleBadgeVariant,
  workspaceRoleLabel,
} from '@/lib/workspaceRoles';

type Props = {
  customer: CustomerMe | null;
  activateWorkspace: (workspaceId: string) => Promise<CustomerMe | null>;
  navigate: NavigateFunction;
};

function WorkspaceRoleBadge({ role }: { role: CustomerWorkspaceSummary['role'] }) {
  if (!role) return null;
  const variant = workspaceRoleBadgeVariant(role);
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide',
        workspaceRoleBadgeClassName(variant, 'compact'),
      )}
    >
      {workspaceRoleLabel(role)}
    </span>
  );
}

function WorkspacePlanBadge({ planName }: { planName?: string }) {
  const label = planName?.trim();
  if (!label) return null;
  return (
    <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </span>
  );
}

export const WorkspaceSwitcher = forwardRef<HTMLDetailsElement, Props>(function WorkspaceSwitcher(
  { customer, activateWorkspace, navigate },
  ref,
) {
  const menuId = useId();
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const { workspace: activeWorkspace, activeWorkspaceId } = resolveActiveCustomerWorkspace(customer);
  const workspaces = customer?.workspaces ?? [];
  const displayName = activeWorkspaceNavbarLabel(customer);
  const busy = activatingId != null;

  const closeMenu = () => {
    if (ref && typeof ref !== 'function' && ref.current) {
      ref.current.removeAttribute('open');
    }
  };

  const handleSelect = async (workspace: CustomerWorkspaceSummary) => {
    if (busy || workspace.id === activeWorkspaceId) return;
    setActivatingId(workspace.id);
    try {
      const updated = await activateWorkspace(workspace.id);
      if (!updated) {
        appToast.error('Could not switch workspace.');
        return;
      }
      closeMenu();
      navigate(resolvePathAfterWorkspaceSwitch(updated), { replace: true });
    } catch {
      appToast.error('Could not switch workspace.');
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className="min-w-0 max-w-[14rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-800"
        title={displayName}
      >
        {displayName}
      </span>
      <WorkspacePlanBadge planName={activeWorkspace?.planName} />
      <details ref={ref} className="relative min-w-0">
        <summary
          className="inline-flex cursor-pointer list-none items-center justify-center rounded-md p-1 text-slate-400 transition-colors nav-hover [&::-webkit-details-marker]:hidden"
          aria-label="Workspace menu"
          aria-haspopup="listbox"
          aria-controls={menuId}
        >
          <ChevronsUpDown size={13} strokeWidth={1.9} aria-hidden />
        </summary>
        <div
          id={menuId}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-[16rem] rounded-xl bg-white p-1.5 shadow-[var(--shadow-dropdown)]"
          style={{ border: '1px solid var(--border-soft)' }}
          role="listbox"
          aria-label="Workspaces"
        >
          <p className="mb-1 px-2.5 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">
            Workspaces
          </p>
          {workspaces.length > 0 ? (
            <ul className="m-0 flex max-h-72 flex-col gap-0.5 overflow-y-auto p-0 list-none">
              {workspaces.map((workspace) => {
                const isActive = workspace.id === activeWorkspaceId;
                const isLoading = activatingId === workspace.id;
                return (
                  <li key={workspace.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      aria-current={isActive ? 'true' : undefined}
                      disabled={isActive || busy}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                        isActive
                          ? 'cursor-default bg-slate-50 text-slate-700'
                          : 'cursor-pointer hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60',
                      )}
                      onClick={() => void handleSelect(workspace)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-900">
                          {workspace.name?.trim() || 'Workspace'}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <WorkspaceRoleBadge role={workspace.role} />
                          <WorkspacePlanBadge planName={workspace.planName} />
                        </span>
                      </span>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-teal-600" aria-hidden>
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isActive ? (
                          <Check className="h-4 w-4" strokeWidth={2.25} />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-md bg-slate-50 px-2.5 py-2">
              <span className="text-sm font-medium text-slate-900">{displayName}</span>
            </div>
          )}
        </div>
      </details>
    </div>
  );
});
