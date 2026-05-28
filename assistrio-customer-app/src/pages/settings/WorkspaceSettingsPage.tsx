import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteWorkspace, patchWorkspace } from '@/api/customerApi';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { DeleteWorkspaceModal } from '@/components/settings/DeleteWorkspaceModal';
import { SettingsCopyButton } from '@/components/settings/SettingsCopyButton';
import { SettingsInfoRow } from '@/components/settings/SettingsInfoRow';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { appToast } from '@/lib/app-toast';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { resolvePathAfterWorkspaceSwitch } from '@/lib/workspaceSwitchNavigation';
import { isWorkspaceManagerRole } from '@/lib/workspaceRoles';

function isPaidWorkspace(planKey?: string, subscriptionStatus?: string): boolean {
  if (!planKey || planKey === 'free') return false;
  if (subscriptionStatus === 'free' || subscriptionStatus === 'trialing') return false;
  return true;
}

export function WorkspaceSettingsPage() {
  const navigate = useNavigate();
  const { customer, applyCustomerSession } = useCustomerAuth();
  const { workspace, activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const canManageWorkspace = isWorkspaceManagerRole(role);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const nameInputId = useId();

  const workspaceName = workspace?.name?.trim() || 'Workspace';
  const workspaceId = activeWorkspaceId ?? '';
  const [editedName, setEditedName] = useState(workspaceName);
  const hasUnsavedNameChange = editedName.trim() !== workspaceName;
  const paidWorkspace = isPaidWorkspace(workspace?.planKey, workspace?.subscriptionStatus);
  const canDeleteWorkspace = role === 'owner' && paidWorkspace;

  useEffect(() => {
    setEditedName(workspaceName);
  }, [workspaceName]);

  async function handleSaveName() {
    if (!activeWorkspaceId || !canManageWorkspace) return;
    const trimmed = editedName.trim();
    if (!trimmed) {
      appToast.error('Workspace name cannot be empty.');
      return;
    }
    setSavingName(true);
    const result = await patchWorkspace(activeWorkspaceId, { name: trimmed });
    setSavingName(false);
    if (!result.ok) {
      appToast.error(result.error || 'Could not save workspace name.');
      return;
    }
    applyCustomerSession(result.data.session);
    setEditedName(result.data.workspace.name);
    appToast.success('Workspace name saved.');
  }

  async function handleDeleteWorkspace() {
    if (!activeWorkspaceId) return;
    const result = await deleteWorkspace(activeWorkspaceId);
    if (!result.ok) {
      appToast.error(result.error || 'Could not delete workspace.');
      return;
    }
    applyCustomerSession(result.data.session);
    appToast.success('Workspace deleted.');
    setDeleteModalOpen(false);
    navigate(resolvePathAfterWorkspaceSwitch(result.data.session), { replace: true });
  }

  const deleteDisabledCopy = useMemo(() => {
    if (role !== 'owner') return null;
    if (!paidWorkspace) return 'Workspace deletion is available for paid workspaces.';
    return null;
  }, [paidWorkspace, role]);

  if (!activeWorkspaceId || !workspace) {
    return (
      <>
        <SettingsPageHeader
          settingsRoute="/settings/workspace"
          title="General"
          description="View workspace details and manage permanent deletion."
        />
        <WorkspaceContentContainer size="editor" className="pt-0">
          <Card className="border-slate-200/90 shadow-[var(--shadow-card)]">
            <CardBody>
              <p className="m-0 text-sm leading-relaxed text-slate-600">
                No active workspace selected. Choose a workspace from the header switcher to view its settings.
              </p>
            </CardBody>
          </Card>
        </WorkspaceContentContainer>
      </>
    );
  }

  return (
    <>
      <SettingsPageHeader
        settingsRoute="/settings/workspace"
        title="General"
        description="View workspace details and manage permanent deletion."
      />

      <WorkspaceContentContainer size="editor" className="pt-0">
        <div className="flex flex-col gap-4">
          <Card className="border-slate-200/90 shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">Workspace details</CardTitle>
              <CardDescription className="text-sm">
                Basic information about your workspace.
              </CardDescription>
            </CardHeader>
            <CardBody className="pt-0">
              <SettingsInfoRow
                label="Workspace ID"
                value={
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    <code className="font-mono text-[0.8125rem] text-slate-800">{workspaceId}</code>
                    <SettingsCopyButton value={workspaceId} label="ID" />
                  </span>
                }
              />
              <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <Label
                  htmlFor={nameInputId}
                  className="text-sm font-medium text-slate-500 sm:min-w-[8.5rem] sm:pt-1.5"
                >
                  Workspace name
                </Label>
                <div className="min-w-0 w-full sm:max-w-md">
                  <Input
                    id={nameInputId}
                    value={editedName}
                    onChange={(event) => setEditedName(event.target.value)}
                    inputSize="md"
                    quiet
                    className="w-full"
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={!canManageWorkspace}
                  />
                  {canManageWorkspace ? (
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0"
                        disabled={!hasUnsavedNameChange || savingName || !editedName.trim()}
                        onClick={() => void handleSaveName()}
                      >
                        {savingName ? 'Updating…' : 'Update settings'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardBody>
          </Card>

          <section className="mt-6 border-t border-slate-200/90 pt-6">
            <Card className="border-red-200/70 bg-red-50/25 shadow-[var(--shadow-card)]">
              <CardHeader className="border-red-100/60 pb-3">
                <CardTitle className="text-base text-red-700">Danger zone</CardTitle>
                <CardDescription className="text-sm text-red-600">
                  Irreversible and destructive actions for this workspace.
                </CardDescription>
              </CardHeader>
              <CardBody className="pt-0">
                <div className="flex flex-col gap-3 border-t border-red-100/60 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-medium text-slate-900">Delete workspace</p>
                    <p className="m-0 mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
                      Permanently delete this workspace and remove its data. This action cannot be undone.
                    </p>
                    {deleteDisabledCopy ? (
                      <p className="m-0 mt-2 text-sm text-slate-500">{deleteDisabledCopy}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="shrink-0 self-start sm:self-center"
                    disabled={!canDeleteWorkspace}
                    onClick={() => setDeleteModalOpen(true)}
                  >
                    Delete workspace
                  </Button>
                </div>
              </CardBody>
            </Card>
          </section>
        </div>
      </WorkspaceContentContainer>

      <DeleteWorkspaceModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        workspaceName={workspaceName}
        onDelete={handleDeleteWorkspace}
      />
    </>
  );
}
