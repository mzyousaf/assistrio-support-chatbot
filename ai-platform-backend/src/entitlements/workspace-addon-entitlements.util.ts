import { isLegacyKbAddonKey } from '../entitlements/addon-catalog';
import type { EntitlementsKbSizeInput } from './bot-knowledge-size-from-entitlements.util';
import type { WorkspaceEntitlements } from './workspace-entitlements.types';

export type ActiveWorkspaceAddonRow = {
  addonKey: string;
  targetBotId?: string | { toString(): string } | null;
  status: string;
};

export function formatActiveAddonLabel(addon: ActiveWorkspaceAddonRow): string {
  const key = String(addon.addonKey ?? '').trim();
  const botId = addon.targetBotId != null ? String(addon.targetBotId).trim() : '';
  if (botId.length > 0) return `${key}:${botId}`;
  return key;
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
): Pick<
  WorkspaceEntitlements,
  | 'botLimit'
  | 'canRemoveBranding'
  | 'activeAddons'
  | 'kbStorageBonusMbByBotId'
> {
  const active = activeAddons.filter(
    (addon) => addon.status === 'active' && !isLegacyKbAddonKey(addon.addonKey),
  );
  const labels = active.map(formatActiveAddonLabel);

  let botLimit = base.botLimit;
  if (active.some((addon) => addon.addonKey === 'extra_bot')) {
    botLimit = base.botLimit + 1;
  }

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
