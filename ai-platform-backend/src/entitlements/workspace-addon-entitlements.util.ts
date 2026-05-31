import { isLegacyKbAddonKey } from '../entitlements/addon-catalog';
import type { EntitlementsKbSizeInput } from './bot-knowledge-size-from-entitlements.util';
import type { WorkspaceEntitlements } from './workspace-entitlements.types';

export type ActiveWorkspaceAddonRow = {
  addonKey: string;
  targetBotId?: string | { toString(): string } | null;
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
};

export function formatActiveAddonLabel(addon: ActiveWorkspaceAddonRow): string {
  const key = String(addon.addonKey ?? '').trim();
  const botId = addon.targetBotId != null ? String(addon.targetBotId).trim() : '';
  if (botId.length > 0) return `${key}:${botId}`;
  return key;
}

/** Whether an add-on row still grants entitlements (active through period end when canceling). */
export function isWorkspaceAddonEntitlementActive(
  addon: ActiveWorkspaceAddonRow,
  now: Date = new Date(),
): boolean {
  if (isLegacyKbAddonKey(addon.addonKey)) return false;

  const status = String(addon.status ?? '').trim().toLowerCase();
  if (status === 'active' || status === 'past_due' || status === 'payment_failed') return true;
  if (status === 'expired') return false;

  const endRaw = addon.currentPeriodEnd;
  const end = endRaw ? new Date(endRaw) : null;
  const periodStillOpen = Boolean(end && !Number.isNaN(end.getTime()) && end > now);

  if (status === 'cancelled' && periodStillOpen) return true;
  if (addon.cancelAtPeriodEnd && periodStillOpen) return true;

  return false;
}

export function countActiveExtraBotAddons(
  activeAddons: ActiveWorkspaceAddonRow[],
  now: Date = new Date(),
): number {
  return activeAddons.filter(
    (addon) => addon.addonKey === 'extra_bot' && isWorkspaceAddonEntitlementActive(addon, now),
  ).length;
}

export function applyWorkspaceAddonEntitlements(
  base: Pick<
    WorkspaceEntitlements,
    | 'botLimit'
    | 'canRemoveBranding'
    | 'activeAddons'
    | 'kbStorageMbPerBot'
    | 'maxKbStorageMbPerBot'
    | 'kbStorageBytesPerBot'
    | 'maxKbStorageBytesPerBot'
    | 'kbStorageBonusMbByBotId'
  >,
  activeAddons: ActiveWorkspaceAddonRow[],
  now: Date = new Date(),
): Pick<
  WorkspaceEntitlements,
  | 'botLimit'
  | 'canRemoveBranding'
  | 'activeAddons'
  | 'kbStorageBonusMbByBotId'
> {
  const active = activeAddons.filter((addon) => isWorkspaceAddonEntitlementActive(addon, now));
  const labels = active.map(formatActiveAddonLabel);

  const extraBotCount = countActiveExtraBotAddons(active, now);
  const botLimit = base.botLimit + extraBotCount;

  const canRemoveBranding = active.some((addon) => addon.addonKey === 'remove_branding');

  return {
    botLimit,
    canRemoveBranding,
    activeAddons: labels,
    kbStorageBonusMbByBotId: {},
  };
}

/** Per-bot trained-KB quota from base plan limits only (retired KB add-ons do not increase storage). */
export function resolveKbEntitlementsForBot(
  entitlements: Pick<
    WorkspaceEntitlements,
    | 'planName'
    | 'kbStorageMbPerBot'
    | 'kbStorageBytesPerBot'
    | 'maxKbStorageMbPerBot'
    | 'maxKbStorageBytesPerBot'
    | 'kbStorageBonusMbByBotId'
  >,
  _botId: string,
): EntitlementsKbSizeInput {
  return {
    planName: entitlements.planName,
    kbStorageBytesPerBot: entitlements.kbStorageBytesPerBot,
    maxKbStorageBytesPerBot: entitlements.maxKbStorageBytesPerBot,
  };
}
