import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import {
  deleteWorkspaceMember,
  getWorkspaceInvites,
  getWorkspaceMembers,
  patchWorkspaceInviteRole,
  patchWorkspaceMemberRole,
  postWorkspaceInviteCancel,
  postWorkspaceInviteResend,
} from '@/api/customerApi';
import type { WorkspaceInviteRole, WorkspaceInviteSummary, WorkspaceMemberSummary } from '@/api/types';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { InviteMemberModal } from '@/components/settings/InviteMemberModal';
import { SettingsMembersConfirmModal } from '@/components/settings/SettingsMembersConfirmModal';
import { buildWorkspacePersonRows, WorkspacePeopleTable, type WorkspacePersonRow } from '@/components/settings/WorkspacePeopleTable';
import { Button } from '@/components/ui';
import { DataPageLayout } from '@/layout/workspace-layout';
import { appToast } from '@/lib/app-toast';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import {
  copyTextToClipboard,
  countWorkspaceSeatsUsed,
  formatWorkspaceMemberName,
  isPendingWorkspaceInvite,
  isWorkspaceMembersAccessDenied,
  workspaceMembersErrorMessage,
} from '@/lib/workspaceMembersMessages';
import {
  isWorkspaceManagerRole,
  isWorkspaceOwnerRole,
} from '@/lib/workspaceRoles';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function MembersPageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading members">
      <div className="h-24 animate-pulse rounded-xl border border-slate-200/90 bg-white" />
      <div className="h-48 animate-pulse rounded-xl border border-slate-200/90 bg-white" />
      <div className="h-36 animate-pulse rounded-xl border border-slate-200/90 bg-white" />
    </div>
  );
}

export function SettingsMembersPage() {
  const { customer } = useCustomerAuth();
  const { workspace, activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const canManageRoles = isWorkspaceOwnerRole(role);

  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [invites, setInvites] = useState<WorkspaceInviteSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [accessDenied, setAccessDenied] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMemberSummary | null>(null);
  const [cancelTarget, setCancelTarget] = useState<WorkspaceInviteSummary | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);

  const canManageMembers = isWorkspaceManagerRole(role);

  const pendingInvites = useMemo(() => invites.filter(isPendingWorkspaceInvite), [invites]);
  const directoryRows = useMemo(
    () => buildWorkspacePersonRows(members, invites),
    [members, invites],
  );
  const seatsUsed = useMemo(() => countWorkspaceSeatsUsed(members.length, invites), [members.length, invites]);
  const memberLimit = workspace?.memberLimit ?? null;

  const refreshData = useCallback(async () => {
    if (!activeWorkspaceId || !canManageMembers) return;
    const [membersResult, invitesResult] = await Promise.all([
      getWorkspaceMembers(activeWorkspaceId),
      getWorkspaceInvites(activeWorkspaceId),
    ]);

    if (isWorkspaceMembersAccessDenied(membersResult) || isWorkspaceMembersAccessDenied(invitesResult)) {
      setAccessDenied(true);
      setLoadState('ready');
      return;
    }

    if (!membersResult.ok || !invitesResult.ok) {
      setLoadState('error');
      const failed = !membersResult.ok ? membersResult : invitesResult;
      appToast.error(workspaceMembersErrorMessage(failed, 'Could not load workspace members.'));
      return;
    }

    setAccessDenied(false);
    setMembers(membersResult.data);
    setInvites(invitesResult.data);
    setLoadState('ready');
  }, [activeWorkspaceId, canManageMembers]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setLoadState('ready');
      return;
    }
    if (!canManageMembers) {
      setLoadState('ready');
      return;
    }
    setLoadState('loading');
    void refreshData();
  }, [activeWorkspaceId, canManageMembers, refreshData]);

  const handleRemoveMember = async () => {
    if (!activeWorkspaceId || !removeTarget) return;
    setRemoveBusy(true);
    const result = await deleteWorkspaceMember(activeWorkspaceId, removeTarget.userId);
    setRemoveBusy(false);
    if (!result.ok) {
      appToast.error(workspaceMembersErrorMessage(result, 'Could not remove member.'));
      return;
    }
    setRemoveTarget(null);
    appToast.success('Member removed.');
    await refreshData();
  };

  const handleCancelInvite = async () => {
    if (!activeWorkspaceId || !cancelTarget) return;
    setCancelBusy(true);
    const result = await postWorkspaceInviteCancel(activeWorkspaceId, cancelTarget.id);
    setCancelBusy(false);
    if (!result.ok) {
      appToast.error(workspaceMembersErrorMessage(result, 'Could not cancel invite.'));
      return;
    }
    setCancelTarget(null);
    appToast.success('Invite cancelled.');
    await refreshData();
  };

  const handleResendInvite = async (invite: WorkspaceInviteSummary) => {
    if (!activeWorkspaceId) return;
    setResendBusyId(invite.id);
    const result = await postWorkspaceInviteResend(activeWorkspaceId, invite.id);
    setResendBusyId(null);
    if (!result.ok) {
      appToast.error(workspaceMembersErrorMessage(result, 'Could not resend invite.'));
      return;
    }
    appToast.success('Invite resent.');
    if (result.data.inviteUrl?.trim()) {
      const copied = await copyTextToClipboard(result.data.inviteUrl.trim());
      if (copied) {
        appToast.info('Invite link copied to clipboard.');
      }
    }
    await refreshData();
  };

  const handleRoleChange = async (row: WorkspacePersonRow, nextRole: WorkspaceInviteRole) => {
    if (!activeWorkspaceId || !canManageRoles) return;
    if (row.kind === 'member') {
      const result = await patchWorkspaceMemberRole(activeWorkspaceId, row.member.userId, nextRole);
      if (!result.ok) {
        appToast.error(workspaceMembersErrorMessage(result, 'Could not update member role.'));
        return;
      }
    } else {
      const result = await patchWorkspaceInviteRole(activeWorkspaceId, row.invite.id, nextRole);
      if (!result.ok) {
        appToast.error(workspaceMembersErrorMessage(result, 'Could not update invite role.'));
        return;
      }
    }
    appToast.success('Role updated.');
    await refreshData();
  };

  const inviteButton =
    canManageMembers && activeWorkspaceId && !accessDenied ? (
      <Button type="button" variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Invite member
      </Button>
    ) : null;

  if (!activeWorkspaceId || !workspace) {
    return (
      <DataPageLayout
        title="Members"
        description="Manage who can access this workspace."
        containerSize="standard"
      >
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="m-0 text-[0.9375rem] leading-[1.5] text-slate-600">
            No active workspace is selected. Choose a workspace to manage members.
          </p>
        </div>
      </DataPageLayout>
    );
  }

  const showReadOnly = !canManageMembers || accessDenied;

  return (
    <>
      <DataPageLayout
        title="Members"
        description="Manage who can access this workspace."
        actions={inviteButton}
        containerSize="standard"
      >
        {showReadOnly ? (
          <div
            className="mb-5 rounded-lg border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-[0.9375rem] text-slate-600"
            role="status"
          >
            Only workspace owners and admins can manage members.
          </div>
        ) : null}

        {canManageMembers && !accessDenied ? (
          loadState === 'loading' ? (
            <MembersPageSkeleton />
          ) : loadState === 'error' ? (
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
              <p className="m-0 text-[0.9375rem] text-slate-600">
                Could not load members.{' '}
                <button
                  type="button"
                  className="cursor-pointer border-none bg-transparent p-0 font-semibold text-teal-700 underline"
                  onClick={() => {
                    setLoadState('loading');
                    void refreshData();
                  }}
                >
                  Retry
                </button>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <section
                className="rounded-[0.625rem] border border-slate-100 bg-white p-[1.25rem_1.35rem]"
                aria-labelledby="members-usage-heading"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50 text-slate-600"
                    aria-hidden
                  >
                    <Users className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="members-usage-heading"
                      className="mb-1 mt-0 text-base font-semibold tracking-tight text-slate-900"
                    >
                      Seat usage
                    </h2>
                    <p className="m-0 text-[0.9375rem] leading-[1.5] text-slate-600">
                      {memberLimit != null && memberLimit > 0
                        ? `${seatsUsed} of ${memberLimit} seats used`
                        : `${seatsUsed} seats used`}
                      {pendingInvites.length > 0
                        ? ` (${pendingInvites.length} pending invite${pendingInvites.length === 1 ? '' : 's'})`
                        : null}
                    </p>
                  </div>
                </div>
              </section>

              <section
                className="rounded-[0.625rem] border border-slate-100 bg-white p-[1.25rem_1.35rem]"
                aria-labelledby="workspace-people-heading"
              >
                <div className="mb-4">
                  <h2
                    id="workspace-people-heading"
                    className="m-0 text-base font-semibold tracking-tight text-slate-900"
                  >
                    Workspace people
                  </h2>
                </div>
                <WorkspacePeopleTable
                  rows={directoryRows}
                  canManageRoles={canManageRoles}
                  resendBusyId={resendBusyId}
                  onRemoveMember={setRemoveTarget}
                  onCancelInvite={setCancelTarget}
                  onResendInvite={(invite) => void handleResendInvite(invite)}
                  onRoleChange={(row, nextRole) => void handleRoleChange(row, nextRole)}
                />
              </section>
            </div>
          )
        ) : null}
      </DataPageLayout>

      {activeWorkspaceId ? (
        <InviteMemberModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          workspaceId={activeWorkspaceId}
          canAssignBotAccess={canManageRoles}
          onInvited={refreshData}
        />
      ) : null}

      <SettingsMembersConfirmModal
        open={!!removeTarget}
        onClose={() => {
          if (!removeBusy) setRemoveTarget(null);
        }}
        onConfirm={handleRemoveMember}
        title="Remove this member?"
        description={
          removeTarget ? (
            <span>
              <strong>{formatWorkspaceMemberName(removeTarget)}</strong> will lose access to this workspace.
            </span>
          ) : undefined
        }
        confirmLabel="Remove"
        busyLabel="Removing…"
        busy={removeBusy}
        tone="danger"
      />

      <SettingsMembersConfirmModal
        open={!!cancelTarget}
        onClose={() => {
          if (!cancelBusy) setCancelTarget(null);
        }}
        onConfirm={handleCancelInvite}
        title="Cancel this invite?"
        description={
          cancelTarget ? (
            <span>
              The pending invite for <strong>{cancelTarget.email}</strong> will be cancelled.
            </span>
          ) : undefined
        }
        confirmLabel="Cancel invite"
        busyLabel="Cancelling…"
        busy={cancelBusy}
        tone="danger"
      />
    </>
  );
}
