/** Workspace default bot access policy (Epic 5C Step 5). Backend-only for now — no customer app UI. TODO: remove if still unused. */
export type WorkspaceDefaultBotAccessPolicy = {
  grantViewToWorkspacePeopleOnCreate: boolean;
  grantPreviewToWorkspacePeopleOnCreate: boolean;
};

export const DEFAULT_WORKSPACE_DEFAULT_BOT_ACCESS_POLICY: WorkspaceDefaultBotAccessPolicy = {
  grantViewToWorkspacePeopleOnCreate: false,
  grantPreviewToWorkspacePeopleOnCreate: false,
};

export const WORKSPACE_OWNER_REQUIRED_CODE = 'workspace_owner_required';
export const WORKSPACE_OWNER_REQUIRED_MESSAGE = 'Workspace owner access required.';

/** Preview implies view; turning view off clears preview. */
export function normalizeWorkspaceDefaultBotAccessPolicy(
  input?: Partial<WorkspaceDefaultBotAccessPolicy> | null,
): WorkspaceDefaultBotAccessPolicy {
  const preview = input?.grantPreviewToWorkspacePeopleOnCreate === true;
  const view = preview || input?.grantViewToWorkspacePeopleOnCreate === true;
  return {
    grantViewToWorkspacePeopleOnCreate: view,
    grantPreviewToWorkspacePeopleOnCreate: preview && view,
  };
}

export function parseWorkspaceDefaultBotAccessPolicyPatch(
  body: unknown,
): WorkspaceDefaultBotAccessPolicy | null {
  if (!body || typeof body !== 'object') return null;
  const policyRaw = (body as { defaultBotAccessPolicy?: unknown }).defaultBotAccessPolicy;
  if (!policyRaw || typeof policyRaw !== 'object' || Array.isArray(policyRaw)) return null;
  const p = policyRaw as Record<string, unknown>;
  return normalizeWorkspaceDefaultBotAccessPolicy({
    grantViewToWorkspacePeopleOnCreate: p.grantViewToWorkspacePeopleOnCreate === true,
    grantPreviewToWorkspacePeopleOnCreate: p.grantPreviewToWorkspacePeopleOnCreate === true,
  });
}
