import { Copy, Loader2, Send, Trash2 } from 'lucide-react';
import type { WorkspaceInviteRole, WorkspaceInviteSummary, WorkspaceMemberSummary } from '@/api/types';
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

function RoleBadge({ role }: { role: WorkspacePersonRow['role'] }) {
  const variant = workspaceRoleBadgeVariant(role);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        workspaceRoleBadgeClassName(variant, 'pill'),
      )}
    >
      {workspaceRoleLabel(role)}
    </span>
  );
}

type Props = {
  rows: WorkspacePersonRow[];
  canManageRoles: boolean;
  resendBusyId: string | null;
  onRemoveMember: (member: WorkspaceMemberSummary) => void;
  onCancelInvite: (invite: WorkspaceInviteSummary) => void;
  onResendInvite: (invite: WorkspaceInviteSummary) => void;
  onRoleChange: (row: WorkspacePersonRow, role: WorkspaceInviteRole) => void;
};

export function WorkspacePeopleTable({
  rows,
  canManageRoles,
  resendBusyId,
  onRemoveMember,
  onCancelInvite,
  onResendInvite,
  onRoleChange,
}: Props) {
  if (rows.length === 0) {
    return <p className="m-0 text-[0.9375rem] text-slate-500">No people found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left text-[0.9375rem]">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="pb-2 pr-4 font-medium">Name / email</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Role</th>
            <th className="pb-2 pr-4 font-medium">Bot access</th>
            <th className="pb-2 pr-4 font-medium">Joined / invited</th>
            <th className="pb-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOwner = row.kind === 'member' && isWorkspaceOwnerRole(row.role);
            const resending = row.kind === 'invite' && resendBusyId === row.id;
            return (
              <tr key={`${row.kind}:${row.id}`} className="border-b border-slate-50 last:border-b-0">
                <td className="py-3 pr-4">
                  <div className="font-medium text-slate-900">{row.name}</div>
                  {row.name !== row.email ? <div className="text-sm text-slate-500">{row.email}</div> : null}
                </td>
                <td className="py-3 pr-4 text-slate-600">{row.status}</td>
                <td className="py-3 pr-4">
                  {canManageRoles && !isOwner && row.status !== 'Cancelled' ? (
                    <select
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                      value={row.role === 'owner' ? 'admin' : row.role}
                      onChange={(e) => onRoleChange(row, e.target.value as WorkspaceInviteRole)}
                      aria-label={`Role for ${row.email}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <RoleBadge role={row.role} />
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-600">{formatBotAccessSummary(row.botAccessSummary)}</td>
                <td className="py-3 pr-4 text-slate-600">{row.dateLabel}</td>
                <td className="py-3 text-right">
                  {row.kind === 'member' ? (
                    !isOwner ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-600 hover:text-red-700"
                        onClick={() => onRemoveMember(row.member)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Remove
                      </Button>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )
                  ) : row.status === 'Pending invite' ? (
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      {row.invite.inviteUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-slate-600"
                          onClick={() =>
                            void copyTextToClipboard(row.invite.inviteUrl ?? '').then((copied) => {
                              if (copied) appToast.success('Invite link copied.');
                              else appToast.error('Could not copy invite link.');
                            })
                          }
                        >
                          <Copy className="h-4 w-4" aria-hidden />
                          Copy
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-600"
                        disabled={resending}
                        onClick={() => onResendInvite(row.invite)}
                      >
                        {resending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                        Resend
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-600 hover:text-red-700"
                        onClick={() => onCancelInvite(row.invite)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
