import { useEffect, useId, useState } from 'react';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { DeleteWorkspaceModal } from '@/components/settings/DeleteWorkspaceModal';
import { SettingsCopyButton } from '@/components/settings/SettingsCopyButton';
import { SettingsInfoRow } from '@/components/settings/SettingsInfoRow';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { appToast } from '@/lib/app-toast';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';

export function WorkspaceSettingsPage() {
  const { customer } = useCustomerAuth();
  const { workspace, activeWorkspaceId } = resolveActiveCustomerWorkspace(customer);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const nameInputId = useId();

  const workspaceName = workspace?.name?.trim() || 'Workspace';
  const workspaceId = activeWorkspaceId ?? '';
  const [editedName, setEditedName] = useState(workspaceName);
  const hasUnsavedNameChange = editedName.trim() !== workspaceName;

  useEffect(() => {
    setEditedName(workspaceName);
  }, [workspaceName]);

  function handleSaveNamePlaceholder() {
    appToast.info('Workspace name editing is not connected yet.');
  }

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
                  />
                  {hasUnsavedNameChange ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <p className="m-0 text-xs leading-relaxed text-slate-500">
                        Workspace name changes are not saved yet.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0 self-start sm:self-auto"
                        onClick={handleSaveNamePlaceholder}
                      >
                        Save changes
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
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="shrink-0 self-start sm:self-center"
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
      />
    </>
  );
}
