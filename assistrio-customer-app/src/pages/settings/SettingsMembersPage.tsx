import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, UserPlus } from 'lucide-react';
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
import { MembersPageSkeleton } from '@/components/settings/MembersPageSkeleton';
import { SettingsMembersConfirmModal } from '@/components/settings/SettingsMembersConfirmModal';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import {
  buildWorkspacePersonRows,
  WorkspacePeopleTable,
  type WorkspacePersonRow,
} from '@/components/settings/WorkspacePeopleTable';
import { WorkspaceSeatUsageCards } from '@/components/settings/WorkspaceSeatUsageCards';
import { Button, Card, CardBody, Tooltip } from '@/components/ui';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
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

function MembersErrorCard(props: { onRetry: () => void }) {
  return (
    <Card className="border-amber-200/90 bg-amber-50/70 shadow-[var(--shadow-card)]">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden />
          <div className="min-w-0">
            <p className="m-0 font-semibold text-amber-950">Could not load members</p>
            <p className="m-0 mt-1 text-sm leading-relaxed text-amber-900/90">
              We couldn&apos;t load workspace people right now.
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={props.onRetry}>
          Retry
        </Button>
      </CardBody>
    </Card>
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

  const showInviteHint = useMemo(
    () => members.length <= 1 && pendingInvites.length === 0,
    [members.length, pendingInvites.length],
  );

  const openInviteModal = useCallback(() => setInviteOpen(true), []);

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
    const previousRole = row.role;
    if (previousRole === nextRole) return;

    if (row.kind === 'member') {
      setMembers((prev) =>
        prev.map((member) =>
          member.userId === row.member.userId ? { ...member, role: nextRole } : member,
        ),
      );
      const result = await patchWorkspaceMemberRole(activeWorkspaceId, row.member.userId, nextRole);
      if (!result.ok) {
        setMembers((prev) =>
          prev.map((member) =>
            member.userId === row.member.userId ? { ...member, role: previousRole } : member,
          ),
        );
        appToast.error(workspaceMembersErrorMessage(result, 'Could not update member role.'));
        return;
      }
    } else {
      setInvites((prev) =>
        prev.map((invite) => (invite.id === row.invite.id ? { ...invite, role: nextRole } : invite)),
      );
      const result = await patchWorkspaceInviteRole(activeWorkspaceId, row.invite.id, nextRole);
      if (!result.ok) {
        setInvites((prev) =>
          prev.map((invite) =>
            invite.id === row.invite.id
              ? { ...invite, role: previousRole as WorkspaceInviteRole }
              : invite,
          ),
        );
        appToast.error(workspaceMembersErrorMessage(result, 'Could not update invite role.'));
        return;
      }
    }
    appToast.success('Role updated.');
  };

  const inviteButton =
    canManageMembers && activeWorkspaceId && !accessDenied ? (
      <Tooltip content="Invite a teammate to this workspace" side="top">
        <Button type="button" variant="primary" size="sm" onClick={openInviteModal}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Invite member
        </Button>
      </Tooltip>
    ) : null;

  if (!activeWorkspaceId || !workspace) {
    return (
      <>
        <SettingsPageHeader
          settingsRoute="/settings/members"
          title="Members Management"
          description="Manage workspace access, roles, and pending invitations."
        />
        <WorkspaceContentContainer size="editor" className="pt-0">
          <Card className="border-slate-200/90 shadow-[var(--shadow-card)]">
            <CardBody>
              <p className="m-0 text-sm leading-relaxed text-slate-600">
                No active workspace is selected. Choose a workspace to manage members.
              </p>
            </CardBody>
          </Card>
        </WorkspaceContentContainer>
      </>
    );
  }

  const showReadOnly = !canManageMembers || accessDenied;

  return (
    <>
      <SettingsPageHeader
        settingsRoute="/settings/members"
        title="Members Management"
        description="Manage workspace access, roles, and pending invitations."
        actions={inviteButton}
      />

      <WorkspaceContentContainer size="editor" className="pt-0">
        {showReadOnly ? (
          <Card className="mb-4 border-slate-200/90 bg-slate-50/80 shadow-[var(--shadow-xs)]">
            <CardBody>
              <p className="m-0 text-sm text-slate-600" role="status">
                Only workspace owners and admins can manage members.
              </p>
            </CardBody>
          </Card>
        ) : null}

        {canManageMembers && !accessDenied ? (
          loadState === 'loading' ? (
            <MembersPageSkeleton />
          ) : loadState === 'error' ? (
            <MembersErrorCard
              onRetry={() => {
                setLoadState('loading');
                void refreshData();
              }}
            />
          ) : (
            <div className="space-y-4">
              <WorkspaceSeatUsageCards
                seatsUsed={seatsUsed}
                memberLimit={memberLimit}
                activeMembers={members.length}
                pendingInvites={pendingInvites.length}
              />
              <WorkspacePeopleTable
                rows={directoryRows}
                canManageRoles={canManageRoles}
                resendBusyId={resendBusyId}
                showInviteHint={showInviteHint}
                onRemoveMember={setRemoveTarget}
                onCancelInvite={setCancelTarget}
                onResendInvite={(invite) => void handleResendInvite(invite)}
                onRoleChange={(row, nextRole) => void handleRoleChange(row, nextRole)}
              />
            </div>
          )
        ) : null}
      </WorkspaceContentContainer>

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
