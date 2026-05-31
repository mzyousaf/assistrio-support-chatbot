import { Logger } from '@nestjs/common';

const logger = new Logger('BillingReconcile');

export type BillingReconcileLogMeta = Record<string, string | number | boolean | null | undefined>;

function write(event: string, meta?: BillingReconcileLogMeta): void {
  logger.log(JSON.stringify({ event, ...meta }));
}

export function logBillingReconcileStarted(meta?: BillingReconcileLogMeta): void {
  write('billing_reconcile_started', meta);
}

export function logBillingReconcileCompleted(
  meta: BillingReconcileLogMeta & {
    durationMs: number;
    scheduledDowngradesApplied: number;
    subscriptionsExpired: number;
    addonsExpired: number;
    topupsExpired: number;
    membersDeactivated: number;
    membersReactivated: number;
    errors: number;
  },
): void {
  write('billing_reconcile_completed', {
    ...meta,
    members_deactivated_count: meta.membersDeactivated,
    members_reactivated_count: meta.membersReactivated,
  });
}

export function logBillingReconcileItemError(
  kind: string,
  workspaceId: string,
  reason: string,
  meta?: BillingReconcileLogMeta,
): void {
  write('billing_reconcile_item_error', {
    kind,
    workspaceId,
    reason,
    ...meta,
  });
}

export function logBillingReconcileScheduledDowngradeApplied(
  workspaceId: string,
  meta: BillingReconcileLogMeta,
): void {
  write('billing_reconcile_scheduled_downgrade_applied', { workspaceId, ...meta });
}

export function logBillingReconcileScheduledPlanIntervalChangesApplied(
  workspaceId: string,
  meta: BillingReconcileLogMeta,
): void {
  write('scheduled_plan_interval_changes_applied', { workspaceId, ...meta });
}

export function logBillingReconcileScheduledAddonIntervalChangesApplied(
  workspaceId: string,
  addonId: string,
  meta: BillingReconcileLogMeta,
): void {
  write('scheduled_addon_interval_changes_applied', { workspaceId, addonId, ...meta });
}

export function logBillingReconcileSubscriptionExpired(
  workspaceId: string,
  meta: BillingReconcileLogMeta,
): void {
  write('billing_reconcile_subscription_expired', { workspaceId, ...meta });
}

export function logBillingReconcileAddonExpired(
  workspaceId: string,
  addonId: string,
  meta: BillingReconcileLogMeta,
): void {
  write('billing_reconcile_addon_expired', { workspaceId, addonId, ...meta });
}

export function logBillingReconcileTopUpExpired(
  workspaceId: string,
  topUpId: string,
  meta: BillingReconcileLogMeta,
): void {
  write('billing_reconcile_topup_expired', { workspaceId, topUpId, ...meta });
}

export function logBillingReconcileMembersAdjusted(
  workspaceId: string,
  meta: BillingReconcileLogMeta,
): void {
  write('billing_reconcile_members_adjusted', { workspaceId, ...meta });
}
