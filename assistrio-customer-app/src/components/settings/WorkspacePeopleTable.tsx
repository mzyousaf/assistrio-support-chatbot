import { Copy, Loader2, Send, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { WorkspaceInviteRole, WorkspaceInviteSummary, WorkspaceMemberSummary } from '@/api/types';
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Select, Tooltip } from '@/components/ui';
import { useIsMobile } from '@/hooks/use-mobile';
import { appToast } from '@/lib/app-toast';
import {
  copyTextToClipboard,
  formatWorkspaceMemberDate,
  formatWorkspaceMemberName,
} from '@/lib/workspaceMembersMessages';
import {
  isWorkspaceOwnerRole,
  workspaceRoleBadgeClassName,
  workspaceRoleBadgeVariant,
  workspaceRoleLabel,
} from '@/lib/workspaceRoles';
import { cn } from '@/lib/utils';

export type WorkspacePersonRow =
  | {
      kind: 'member';
      id: string;
      name: string;
      email: string;
      status: 'Active';
      role: WorkspaceMemberSummary['role'];
      dateLabel: string;
      botAccessSummary?: { viewable: number; previewable: number };
      member: WorkspaceMemberSummary;
    }
  | {
      kind: 'invite';
      id: string;
      name: string;
      email: string;
      status: 'Pending invite' | 'Expired' | 'Cancelled';
      role: WorkspaceInviteSummary['role'];
      dateLabel: string;
      botAccessSummary?: { viewable: number; previewable: number };
      invite: WorkspaceInviteSummary;
    };

export function formatBotAccessSummary(summary?: { viewable: number; previewable: number }): string {
  if (!summary || (summary.viewable === 0 && summary.previewable === 0)) return 'No agent access';
  const parts: string[] = [];
  if (summary.viewable > 0) parts.push(`${summary.viewable} viewable`);
  if (summary.previewable > 0) parts.push(`${summary.previewable} previewable`);
  return parts.join(', ');
}

export function buildWorkspacePersonRows(
  members: WorkspaceMemberSummary[],
  invites: WorkspaceInviteSummary[],
): WorkspacePersonRow[] {
  const memberRows: WorkspacePersonRow[] = members.map((member) => ({
    kind: 'member',
    id: member.userId,
    name: formatWorkspaceMemberName(member),
    email: member.email,
    status: 'Active',
    role: member.role,
    dateLabel: formatWorkspaceMemberDate(member.joinedAt),
    botAccessSummary: member.botAccessSummary,
    member,
  }));

  const inviteRows: WorkspacePersonRow[] = invites
    .filter((invite) => invite.status === 'pending')
    .map((invite) => ({
      kind: 'invite',
      id: invite.id,
      name: invite.email,
      email: invite.email,
      status: 'Pending invite' as const,
      role: invite.role,
      dateLabel: formatWorkspaceMemberDate(invite.createdAt ?? invite.expiresAt),
      botAccessSummary: invite.botAccessSummary,
      invite,
    }));

  return [...memberRows, ...inviteRows];
}

function personInitials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed && trimmed !== email) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0].slice(0, 1).toUpperCase();
  }
  const local = email.split('@')[0] || '';
  const segments = local.split(/[._-]+/).filter(Boolean);
  if (segments.length >= 2) return (segments[0][0] + segments[1][0]).toUpperCase();
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return (local[0] || '?').toUpperCase();
}

function PersonAvatar({ name, email }: { name: string; email: string }) {
  const initials = personInitials(name, email);
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80"
      aria-hidden
    >
      {initials}
    </span>
  );
}

function StatusBadge({ status }: { status: WorkspacePersonRow['status'] }) {
  const isActive = status === 'Active';
  const isPending = status === 'Pending invite';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
        isActive && 'bg-emerald-50 text-emerald-700',
        isPending && 'bg-amber-50 text-amber-800',
        !isActive && !isPending && 'bg-slate-100 text-slate-600',
      )}
    >
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: WorkspacePersonRow['role'] }) {
  const variant = workspaceRoleBadgeVariant(role);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        variant === 'owner' && 'bg-violet-50 text-violet-700',
        variant === 'admin' && 'bg-sky-50 text-sky-700',
        variant === 'member' && workspaceRoleBadgeClassName('member', 'pill'),
      )}
    >
      {workspaceRoleLabel(role)}
    </span>
  );
}

function RoleSelect(props: {
  row: WorkspacePersonRow;
  onRoleChange: (row: WorkspacePersonRow, role: WorkspaceInviteRole) => void;
}) {
  const { row, onRoleChange } = props;
  return (
    <Select
      className="w-full max-w-[8rem] min-w-[6.5rem]"
      triggerClassName="h-7 min-h-7 px-2 text-xs"
      value={row.role === 'owner' ? 'admin' : row.role}
      onChange={(e) => onRoleChange(row, e.target.value as WorkspaceInviteRole)}
      aria-label={`Role for ${row.email}`}
    >
      <option value="admin">Admin</option>
      <option value="member">Member</option>
    </Select>
  );
}

function IconActionButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={props.label} side="top">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={props.disabled}
        aria-label={props.label}
        className={cn(
          'h-7 w-7 p-0 text-slate-400 opacity-70 transition-opacity hover:opacity-100',
          props.destructive ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-slate-700',
        )}
        onClick={props.onClick}
      >
        {props.children}
      </Button>
    </Tooltip>
  );
}

function PersonCell({ row }: { row: WorkspacePersonRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PersonAvatar name={row.name} email={row.email} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{row.name}</div>
        {row.name !== row.email ? (
          <div className="truncate text-xs text-slate-500">{row.email}</div>
        ) : null}
      </div>
    </div>
  );
}

function RowActions(props: {
  row: WorkspacePersonRow;
  resending: boolean;
  onRemoveMember: (member: WorkspaceMemberSummary) => void;
  onCancelInvite: (invite: WorkspaceInviteSummary) => void;
  onResendInvite: (invite: WorkspaceInviteSummary) => void;
}) {
  const { row, resending, onRemoveMember, onCancelInvite, onResendInvite } = props;

  if (row.kind === 'member') {
    if (isWorkspaceOwnerRole(row.role)) {
      return <span className="text-xs text-slate-300" aria-hidden>—</span>;
    }
    return (
      <IconActionButton
        label={`Remove ${row.name}`}
        destructive
        onClick={() => onRemoveMember(row.member)}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </IconActionButton>
    );
  }

  if (row.status !== 'Pending invite') {
    return <span className="text-xs text-slate-300" aria-hidden>—</span>;
  }

  return (
    <div className="inline-flex items-center justify-end gap-0.5">
      {row.invite.inviteUrl ? (
        <IconActionButton
          label={`Copy invite link for ${row.email}`}
          onClick={() =>
            void copyTextToClipboard(row.invite.inviteUrl ?? '').then((copied) => {
              if (copied) appToast.success('Invite link copied.');
              else appToast.error('Could not copy invite link.');
            })
          }
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </IconActionButton>
      ) : null}
      <IconActionButton
        label={`Resend invite to ${row.email}`}
        disabled={resending}
        onClick={() => onResendInvite(row.invite)}
      >
        {resending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Send className="h-3.5 w-3.5" aria-hidden />
        )}
      </IconActionButton>
      <IconActionButton
        label={`Cancel invite for ${row.email}`}
        destructive
        onClick={() => onCancelInvite(row.invite)}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </IconActionButton>
    </div>
  );
}

function RoleCell(props: {
  row: WorkspacePersonRow;
  canManageRoles: boolean;
  onRoleChange: (row: WorkspacePersonRow, role: WorkspaceInviteRole) => void;
}) {
  const { row, canManageRoles, onRoleChange } = props;
  const isOwner = row.kind === 'member' && isWorkspaceOwnerRole(row.role);
  if (canManageRoles && !isOwner && row.status !== 'Cancelled') {
    return <RoleSelect row={row} onRoleChange={onRoleChange} />;
  }
  return <RoleBadge role={row.role} />;
}

function MobilePersonCard(props: {
  row: WorkspacePersonRow;
  canManageRoles: boolean;
  resending: boolean;
  onRemoveMember: (member: WorkspaceMemberSummary) => void;
  onCancelInvite: (invite: WorkspaceInviteSummary) => void;
  onResendInvite: (invite: WorkspaceInviteSummary) => void;
  onRoleChange: (row: WorkspacePersonRow, role: WorkspaceInviteRole) => void;
}) {
  const { row } = props;
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-3 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <PersonCell row={row} />
        <RowActions
          row={row}
          resending={props.resending}
          onRemoveMember={props.onRemoveMember}
          onCancelInvite={props.onCancelInvite}
          onResendInvite={props.onResendInvite}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="mt-0.5">
            <StatusBadge status={row.status} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Role</dt>
          <dd className="mt-0.5">
            <RoleCell row={row} canManageRoles={props.canManageRoles} onRoleChange={props.onRoleChange} />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500">Agent access</dt>
          <dd className="mt-0.5 text-slate-700">{formatBotAccessSummary(row.botAccessSummary)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500">Joined / invited</dt>
          <dd className="mt-0.5 tabular-nums text-slate-700">{row.dateLabel}</dd>
        </div>
      </dl>
    </div>
  );
}

type Props = {
  rows: WorkspacePersonRow[];
  canManageRoles: boolean;
  resendBusyId: string | null;
  showInviteHint?: boolean;
  onRemoveMember: (member: WorkspaceMemberSummary) => void;
  onCancelInvite: (invite: WorkspaceInviteSummary) => void;
  onResendInvite: (invite: WorkspaceInviteSummary) => void;
  onRoleChange: (row: WorkspacePersonRow, role: WorkspaceInviteRole) => void;
};

export function WorkspacePeopleTable({
  rows,
  canManageRoles,
  resendBusyId,
  showInviteHint = false,
  onRemoveMember,
  onCancelInvite,
  onResendInvite,
  onRoleChange,
}: Props) {
  const isMobile = useIsMobile();
  const peopleCountLabel = `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`;

  return (
    <Card id="workspace-people" className="border-slate-200/90 shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-start justify-between gap-3 py-4">
        <div className="min-w-0">
          <CardTitle>Members</CardTitle>
          <CardDescription className="mt-1">
            View members, pending invites, roles, and access.
          </CardDescription>
        </div>
        {rows.length > 0 ? (
          <span className="shrink-0 text-xs font-medium text-slate-500">{peopleCountLabel}</span>
        ) : null}
      </CardHeader>

      <CardBody className="space-y-4 pb-4 pt-0">
        {rows.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">No people found.</p>
        ) : (
          <>
            {isMobile ? (
              <div className="space-y-3">
                {rows.map((row) => (
                  <MobilePersonCard
                    key={`${row.kind}:${row.id}`}
                    row={row}
                    canManageRoles={canManageRoles}
                    resending={row.kind === 'invite' && resendBusyId === row.id}
                    onRemoveMember={onRemoveMember}
                    onCancelInvite={onCancelInvite}
                    onResendInvite={onResendInvite}
                    onRoleChange={onRoleChange}
                  />
                ))}
              </div>
            ) : (
              <table className="mt-3 w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    <th className="pb-2.5 pr-3 font-medium">Person</th>
                    <th className="pb-2.5 pr-3 font-medium">Status</th>
                    <th className="pb-2.5 pr-3 font-medium">Role</th>
                    <th className="hidden pb-2.5 pr-3 font-medium lg:table-cell">Agent access</th>
                    <th className="pb-2.5 pr-3 font-medium">Joined / invited</th>
                    <th className="pb-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const resending = row.kind === 'invite' && resendBusyId === row.id;
                    return (
                      <tr
                        key={`${row.kind}:${row.id}`}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
                      >
                        <td className="py-2.5 pr-3 align-middle">
                          <PersonCell row={row} />
                        </td>
                        <td className="py-2.5 pr-3 align-middle">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="py-2.5 pr-3 align-middle">
                          <RoleCell
                            row={row}
                            canManageRoles={canManageRoles}
                            onRoleChange={onRoleChange}
                          />
                        </td>
                        <td className="hidden py-2.5 pr-3 align-middle text-xs text-slate-600 lg:table-cell">
                          {formatBotAccessSummary(row.botAccessSummary)}
                        </td>
                        <td className="py-2.5 pr-3 align-middle text-xs tabular-nums text-slate-600">
                          {row.dateLabel}
                        </td>
                        <td className="py-2.5 text-right align-middle">
                          <RowActions
                            row={row}
                            resending={resending}
                            onRemoveMember={onRemoveMember}
                            onCancelInvite={onCancelInvite}
                            onResendInvite={onResendInvite}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {showInviteHint ? (
          <p className="m-0 rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-600">
            Invite teammates to collaborate on this workspace.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
