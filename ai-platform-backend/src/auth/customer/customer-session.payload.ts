import type { PlanKey } from '../../entitlements/plan-catalog';
import type { WorkspaceSubscriptionStatus } from '../../models/workspace-subscription.schema';
import type {
  WorkspaceOnboardingStatus,
  WorkspaceOnboardingStep,
} from '../../models/workspace-onboarding.constants';
import type { WorkspaceEntitlementsService } from '../../entitlements/workspace-entitlements.service';
import type { WorkspacesService } from '../../workspaces/workspaces.service';
import type { RequestUser } from '../shared/request-user.types';

/** Plan/entitlement summary embedded in customer session workspace entries. */
export type CustomerSessionWorkspaceSummary = {
  id: string;
  name: string;
  planKey: PlanKey;
  planName: string;
  subscriptionStatus: WorkspaceSubscriptionStatus;
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  showPoweredByAssistrio: boolean;
  onboardingStatus: WorkspaceOnboardingStatus;
  onboardingCurrentStep: WorkspaceOnboardingStep;
  onboardingCreatedBotId: string | null;
};

/** Safe customer session body returned by `GET /api/customer/me` and `GET /api/customer/auth/session`. */
export type CustomerSessionPayload = {
  id: string;
  email: string;
  role: string;
  workspaceIds: string[];
  workspaces: CustomerSessionWorkspaceSummary[];
  firstName?: string;
  lastName?: string;
  picture?: string;
};

async function buildWorkspaceSummaries(
  workspaces: Array<{
    id: string;
    name: string;
    onboardingStatus: CustomerSessionWorkspaceSummary['onboardingStatus'];
    onboardingCurrentStep: CustomerSessionWorkspaceSummary['onboardingCurrentStep'];
    onboardingCreatedBotId: string | null;
  }>,
  entitlementsService: WorkspaceEntitlementsService,
): Promise<CustomerSessionWorkspaceSummary[]> {
  if (workspaces.length === 0) return [];

  return Promise.all(
    workspaces.map(async (workspace) => {
      const entitlements = await entitlementsService.resolveForWorkspace(workspace.id);
      return {
        id: workspace.id,
        name: workspace.name,
        planKey: entitlements.planKey,
        planName: entitlements.planName,
        subscriptionStatus: entitlements.subscriptionStatus,
        botLimit: entitlements.botLimit,
        memberLimit: entitlements.memberLimit,
        monthlyAiCredits: entitlements.monthlyAiCredits,
        kbStorageMbPerBot: entitlements.kbStorageMbPerBot,
        analyticsHistoryDays: entitlements.analyticsHistoryDays,
        canExportReports: entitlements.canExportReports,
        showPoweredByAssistrio: entitlements.showPoweredByAssistrio,
        onboardingStatus: workspace.onboardingStatus,
        onboardingCurrentStep: workspace.onboardingCurrentStep,
        onboardingCreatedBotId: workspace.onboardingCreatedBotId,
      };
    }),
  );
}

/**
 * Replace client-side onboarding heuristic with workspace onboarding state in onboarding epic.
 * `needsOnboarding` is intentionally omitted until workspace onboarding fields exist.
 * `activeWorkspaceId` is deferred to workspace switcher / invite epic.
 */
export async function buildCustomerSessionPayload(
  user: RequestUser,
  workspacesService: WorkspacesService,
  entitlementsService: WorkspaceEntitlementsService,
): Promise<CustomerSessionPayload> {
  const userId = String(user._id);
  await workspacesService.ensurePersonalWorkspaceForUser(userId);
  const workspaceIds = await workspacesService.getWorkspaceIdsForUser(userId);
  const workspaceNames = await workspacesService.getWorkspacesSummaryForUser(userId);
  const workspaces = await buildWorkspaceSummaries(workspaceNames, entitlementsService);

  return {
    id: userId,
    email: user.email,
    role: user.role,
    workspaceIds: workspaceIds.map((id) => String(id)),
    workspaces,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    picture: user.picture ?? undefined,
  };
}
