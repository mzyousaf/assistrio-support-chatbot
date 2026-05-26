import { Building2, CreditCard, Gem, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { SettingsCopyButton } from '@/components/settings/SettingsCopyButton';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { SettingsInfoRow } from '@/components/settings/SettingsInfoRow';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { settingsNavButtonClassName } from '@/components/settings/settingsNavButtonClassName';
import { SettingsStatCard } from '@/components/settings/SettingsStatCard';
import { Card, CardBody } from '@/components/ui';
import {
  buildWorkspaceBillingSessionKey,
  useWorkspaceBillingSummary,
} from '@/hooks/useWorkspaceBillingSummary';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { TRAINED_KNOWLEDGE_STORAGE_LABEL } from '@/lib/trainedKnowledgeStorageCopy';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { cn } from '@/lib/utils';
import {
  workspaceRoleBadgeClassName,
  workspaceRoleBadgeVariant,
  workspaceRoleLabel,
} from '@/lib/workspaceRoles';
import {
  formatSubscriptionStatusLabel,
  formatUsagePeriodDate,
} from '@/pages/usage/usagePageFormat';

function WorkspacePlanBadge({ planName, planKey }: { planName?: string; planKey?: string }) {
  const label = planName?.trim() || (planKey === 'free' ? 'Free' : planKey?.trim() || 'Plan');
  const isFree = (planKey ?? 'free') === 'free';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        isFree
          ? 'bg-slate-100 text-slate-700 ring-slate-200/80'
          : 'bg-teal-50 text-teal-800 ring-teal-100',
      )}
    >
      {label}
    </span>
  );
}

function WorkspaceRoleBadge({ role }: { role: string | null | undefined }) {
  if (!role) return <span className="text-slate-500">—</span>;
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        workspaceRoleBadgeClassName(workspaceRoleBadgeVariant(role), 'compact'),
      )}
    >
      {workspaceRoleLabel(role)}
    </span>
  );
}

function WorkspaceLimitsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading workspace limits">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-200/90 bg-slate-50" />
      ))}
    </div>
  );
}

export function WorkspaceSettingsPage() {
  const { customer } = useCustomerAuth();
  const { workspace, activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const billingSessionKey = buildWorkspaceBillingSessionKey({
    customerId: customer?.id,
    activeWorkspaceId,
    workspaceIds: customer?.workspaceIds,
  });
  const { summary, loadState, errorMessage } = useWorkspaceBillingSummary(
    activeWorkspaceId,
    billingSessionKey,
  );

  const planName = summary?.plan.name ?? workspace?.planName;
  const planKey = summary?.plan.key ?? workspace?.planKey;
  const subscriptionStatus = summary?.plan.status ?? workspace?.subscriptionStatus;
  const workspaceName = workspace?.name?.trim() || summary?.plan.name || 'Workspace';
  const workspaceId = activeWorkspaceId ?? '';

  const botsUsed = summary?.usage.bots.current;
  const botsLimit = summary?.usage.bots.limit ?? workspace?.botLimit;
  const membersUsed = summary?.usage.members.used;
  const membersLimit = summary?.usage.members.limit ?? workspace?.memberLimit;
  const pendingInvites = summary?.usage.members.pendingInvites;
  const activeMembers = summary?.usage.members.current;
  const aiUsed = summary?.usage.aiCredits.monthlyCreditsUsed;
  const aiIncluded = summary?.usage.aiCredits.monthlyCredits ?? workspace?.monthlyAiCredits;
  const kbLimitMb = summary?.entitlements.kbStorageMbPerBot ?? workspace?.kbStorageMbPerBot;

  if (!activeWorkspaceId || !workspace) {
    return (
      <>
        <SettingsPageHeader
          title="Workspace"
          description="Plan, limits, and collaboration for your active workspace."
        />
        <WorkspaceContentContainer size="standard" className="pt-6">
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
        title="Workspace"
        description="Plan, limits, and collaboration for your active workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkspacePlanBadge planName={planName} planKey={planKey} />
            <span className="text-xs font-medium text-slate-500">
              {formatSubscriptionStatusLabel(subscriptionStatus)}
            </span>
          </div>
        }
      />

      <WorkspaceContentContainer size="standard" className="pt-6">
        <div className="flex flex-col gap-4">
          <SettingsInfoCard
            id="workspace-profile"
            icon={Building2}
            title={workspaceName}
            description={
              summary
                ? `Billing period ${formatUsagePeriodDate(summary.plan.currentPeriodStart)} – ${formatUsagePeriodDate(summary.plan.currentPeriodEnd)}`
                : 'Workspace profile and subscription status.'
            }
            variant="hero"
          >
            <div className="space-y-0">
              <SettingsInfoRow
                label="Workspace ID"
                value={
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    <code className="font-mono text-[0.8125rem] text-slate-800">{workspaceId}</code>
                    <SettingsCopyButton value={workspaceId} label="ID" />
                  </span>
                }
              />
              <SettingsInfoRow label="Your role" value={<WorkspaceRoleBadge role={role} />} />
              <SettingsInfoRow
                label="Plan"
                value={<WorkspacePlanBadge planName={planName} planKey={planKey} />}
              />
              <SettingsInfoRow
                label="Subscription"
                value={formatSubscriptionStatusLabel(subscriptionStatus)}
              />
            </div>
          </SettingsInfoCard>

          <SettingsInfoCard
            id="workspace-limits"
            icon={Gem}
            title="Workspace limits"
            description={
              loadState === 'error'
                ? errorMessage ?? 'Could not load latest usage. Showing plan defaults where available.'
                : 'Current usage against your plan limits.'
            }
          >
            {loadState === 'loading' ? (
              <WorkspaceLimitsSkeleton />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SettingsStatCard
                  label="Agents"
                  value={
                    botsUsed != null && botsLimit != null
                      ? `${botsUsed} / ${botsLimit}`
                      : botsLimit != null
                        ? `— / ${botsLimit}`
                        : '—'
                  }
                />
                <SettingsStatCard
                  label="Members"
                  value={
                    membersUsed != null && membersLimit != null
                      ? `${membersUsed} / ${membersLimit}`
                      : membersLimit != null
                        ? `— / ${membersLimit}`
                        : '—'
                  }
                  hint={
                    pendingInvites != null && pendingInvites > 0
                      ? `${pendingInvites} pending invite${pendingInvites === 1 ? '' : 's'}`
                      : undefined
                  }
                />
                <SettingsStatCard
                  label="AI credits"
                  value={
                    aiUsed != null && aiIncluded != null
                      ? `${aiUsed.toLocaleString()} / ${aiIncluded.toLocaleString()}`
                      : aiIncluded != null
                        ? `— / ${aiIncluded.toLocaleString()}`
                        : '—'
                  }
                  hint="This billing period"
                />
                <SettingsStatCard
                  label={TRAINED_KNOWLEDGE_STORAGE_LABEL}
                  value={kbLimitMb != null ? `${kbLimitMb} MB / bot` : '—'}
                />
              </div>
            )}
          </SettingsInfoCard>

          <SettingsInfoCard
            id="workspace-collaboration"
            icon={Users}
            title="Access and collaboration"
            description="Who has access to this workspace."
            action={
              <NavLink to="/settings/members" className={settingsNavButtonClassName('secondary')}>
                Manage members
              </NavLink>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingsStatCard
                label="Active members"
                value={activeMembers != null ? String(activeMembers) : '—'}
              />
              <SettingsStatCard
                label="Pending invites"
                value={pendingInvites != null ? String(pendingInvites) : '—'}
              />
            </div>
          </SettingsInfoCard>

          <SettingsInfoCard
            id="workspace-actions"
            icon={CreditCard}
            title="Workspace actions"
            description="Quick links for plan and billing management."
          >
            <div className="flex flex-wrap gap-2">
              <NavLink to="/settings/plans" className={settingsNavButtonClassName('secondary')}>
                View plans
              </NavLink>
              <NavLink to="/settings/members" className={settingsNavButtonClassName('secondary')}>
                Manage members
              </NavLink>
              <NavLink to="/settings/billing" className={settingsNavButtonClassName('primary')}>
                Billing summary
              </NavLink>
            </div>
          </SettingsInfoCard>
        </div>
      </WorkspaceContentContainer>
    </>
  );
}
