import type { PlanKey } from '../../entitlements/plan-catalog';
import type { WorkspaceSubscriptionStatus } from '../../models/workspace-subscription.schema';
import type {
  WorkspaceOnboardingStatus,
  WorkspaceOnboardingStep,
} from '../../models/workspace-onboarding.constants';
import type { WorkspaceMemberRole } from '../../models/workspace-membership.schema';
import type { WorkspaceEntitlementsService } from '../../entitlements/workspace-entitlements.service';
import type { WorkspacesService } from '../../workspaces/workspaces.service';
import type { RequestUser, CustomerProfileLinks } from '../shared/request-user.types';
import { resolveCustomerSessionProfile } from './customer-profile.resolve.util';

/** Plan/entitlement summary embedded in customer session workspace entries. */
export type CustomerSessionWorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceMemberRole;
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
export type CustomerSessionProfileLinks = {
  linkedinUrl: string | null;
  calendlyUrl: string | null;
  websiteUrl: string | null;
  otherUrl: string | null;
};
export type CustomerSessionPayload = {
  id: string;
  email: string;
  role: string;
  activeWorkspaceId: string | null;
  workspaceIds: string[];
  workspaces: CustomerSessionWorkspaceSummary[];
  firstName?: string;
  lastName?: string;
  picture?: string;
  profileLinks?: CustomerSessionProfileLinks;
};

async function buildWorkspaceSummaries(
  workspaces: Array<{
    id: string;
    name: string;
    role: WorkspaceMemberRole;
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
        role: workspace.role,
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
 * `needsOnboarding` is intentionally omitted; the customer app derives it from
 * `activeWorkspaceId`, `workspaces[].role`, and `workspaces[].onboardingStatus`.
 */
export async function buildCustomerSessionPayload(
  user: RequestUser,
  workspacesService: WorkspacesService,
  entitlementsService: WorkspaceEntitlementsService,
): Promise<CustomerSessionPayload> {
  const userId = String(user._id);
  await workspacesService.ensurePersonalWorkspaceForUser(userId);
  const activeWorkspaceId = await workspacesService.resolveActiveWorkspaceForUser(userId);
  const workspaceSummaries = await workspacesService.getWorkspacesSummaryForUser(userId, activeWorkspaceId);
  const workspaces = await buildWorkspaceSummaries(workspaceSummaries, entitlementsService);
  const profile = resolveCustomerSessionProfile(user);
  const profileLinks = normalizeCustomerSessionProfileLinks(user.profileLinks);

  return {
    id: userId,
    email: user.email,
    role: user.role,
    activeWorkspaceId,
    workspaceIds: workspaceSummaries.map((workspace) => workspace.id),
    workspaces,
    firstName: profile.firstName,
    lastName: profile.lastName,
    picture: profile.picture,
    ...(profileLinks ? { profileLinks } : {}),
  };
}

function normalizeCustomerSessionProfileLinks(
  links: CustomerProfileLinks | undefined,
): CustomerSessionProfileLinks | undefined {
  if (!links) return undefined;
  const linkedinUrl = links.linkedinUrl?.trim() || null;
  const calendlyUrl = links.calendlyUrl?.trim() || null;
  const websiteUrl = links.websiteUrl?.trim() || null;
  const otherUrl = links.otherUrl?.trim() || null;
  if (!linkedinUrl && !calendlyUrl && !websiteUrl && !otherUrl) return undefined;
  return { linkedinUrl, calendlyUrl, websiteUrl, otherUrl };
}
