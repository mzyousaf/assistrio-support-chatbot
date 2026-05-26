import { Copy, Loader2, Send, Trash2, UserPlus } from 'lucide-react';
import type { WorkspaceInviteRole, WorkspaceInviteSummary, WorkspaceMemberSummary } from '@/api/types';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { settingsNavButtonClassName } from '@/components/settings/settingsNavButtonClassName';
import { Button } from '@/components/ui';
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
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-800 ring-1 ring-teal-100"
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
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        isActive && 'bg-emerald-50 text-emerald-800 ring-emerald-100',
        isPending && 'bg-amber-50 text-amber-900 ring-amber-100',
        !isActive && !isPending && 'bg-slate-100 text-slate-600 ring-slate-200/80',
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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        variant === 'owner' && 'bg-violet-50 text-violet-800 ring-violet-100',
        variant === 'admin' && 'bg-sky-50 text-sky-800 ring-sky-100',
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
    <select
      className={cn(
        'h-8 min-w-[7.5rem] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 shadow-[var(--shadow-xs)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/20',
      )}
      value={row.role === 'owner' ? 'admin' : row.role}
      onChange={(e) => onRoleChange(row, e.target.value as WorkspaceInviteRole)}
      aria-label={`Role for ${row.email}`}
    >
      <option value="admin">Admin</option>
      <option value="member">Member</option>
    </select>
  );
}

function CollaborationCallout(props: { onInviteClick: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-teal-200/90 bg-teal-50/30 px-6 py-8 text-center">
      <p className="m-0 text-base font-semibold text-slate-900">Add teammates to collaborate with AI</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        Invite more people to unlock the power of your workspace.
      </p>
      <button
        type="button"
        className={cn(settingsNavButtonClassName('primary'), 'mt-4 inline-flex gap-1.5')}
        onClick={props.onInviteClick}
      >
        <UserPlus size={16} aria-hidden />
        Invite member
      </button>
    </div>
  );
}

type Props = {
  rows: WorkspacePersonRow[];
  canManageRoles: boolean;
  resendBusyId: string | null;
  showCollaborationCallout?: boolean;
  onInviteClick?: () => void;
  onRemoveMember: (member: WorkspaceMemberSummary) => void;
  onCancelInvite: (invite: WorkspaceInviteSummary) => void;
  onResendInvite: (invite: WorkspaceInviteSummary) => void;
  onRoleChange: (row: WorkspacePersonRow, role: WorkspaceInviteRole) => void;
};

export function WorkspacePeopleTable({
  rows,
  canManageRoles,
  resendBusyId,
  showCollaborationCallout = false,
  onInviteClick,
  onRemoveMember,
  onCancelInvite,
  onResendInvite,
  onRoleChange,
}: Props) {
  return (
    <SettingsInfoCard
      id="workspace-people"
      icon={UserPlus}
      title="Workspace people"
      description="Invite, manage, and remove members."
    >
      {showCollaborationCallout && onInviteClick ? (
        <div className="mb-5">
          <CollaborationCallout onInviteClick={onInviteClick} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="m-0 text-sm text-slate-500">No people found.</p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[920px] border-collapse text-left text-[0.875rem]">
            <thead>
              <tr className="border-b border-slate-200 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4 font-semibold">Person</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 pr-4 font-semibold">Role</th>
                <th className="pb-3 pr-4 font-semibold">Agent access</th>
                <th className="pb-3 pr-4 font-semibold">Joined / invited</th>
                <th className="pb-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOwner = row.kind === 'member' && isWorkspaceOwnerRole(row.role);
                const resending = row.kind === 'invite' && resendBusyId === row.id;
                return (
                  <tr
                    key={`${row.kind}:${row.id}`}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                  >
                    <td className="py-3.5 pr-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <PersonAvatar name={row.name} email={row.email} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{row.name}</div>
                          {row.name !== row.email ? (
                            <div className="truncate text-sm text-slate-500">{row.email}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3.5 pr-4">
                      {canManageRoles && !isOwner && row.status !== 'Cancelled' ? (
                        <RoleSelect row={row} onRoleChange={onRoleChange} />
                      ) : (
                        <RoleBadge role={row.role} />
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-600">
                      {formatBotAccessSummary(row.botAccessSummary)}
                    </td>
                    <td className="py-3.5 pr-4 tabular-nums text-slate-600">{row.dateLabel}</td>
                    <td className="py-3.5 text-right">
                      {row.kind === 'member' ? (
                        !isOwner ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Remove ${row.name}`}
                            onClick={() => onRemoveMember(row.member)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            <span className="sr-only sm:not-sr-only">Remove</span>
                          </Button>
                        ) : (
                          <span className="text-sm text-slate-400" aria-hidden>
                            —
                          </span>
                        )
                      ) : row.status === 'Pending invite' ? (
                        <div className="inline-flex flex-wrap items-center justify-end gap-1">
                          {row.invite.inviteUrl ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-slate-600"
                              aria-label={`Copy invite link for ${row.email}`}
                              onClick={() =>
                                void copyTextToClipboard(row.invite.inviteUrl ?? '').then((copied) => {
                                  if (copied) appToast.success('Invite link copied.');
                                  else appToast.error('Could not copy invite link.');
                                })
                              }
                            >
                              <Copy className="h-4 w-4" aria-hidden />
                              <span className="sr-only sm:not-sr-only">Copy</span>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-600"
                            disabled={resending}
                            aria-label={`Resend invite to ${row.email}`}
                            onClick={() => onResendInvite(row.invite)}
                          >
                            {resending ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Send className="h-4 w-4" aria-hidden />
                            )}
                            <span className="sr-only sm:not-sr-only">Resend</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Cancel invite for ${row.email}`}
                            onClick={() => onCancelInvite(row.invite)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            <span className="sr-only sm:not-sr-only">Cancel</span>
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400" aria-hidden>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SettingsInfoCard>
  );
}
