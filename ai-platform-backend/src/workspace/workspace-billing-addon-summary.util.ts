import { WORKSPACE_ADDON_CATALOG, isLegacyKbAddonKey, type WorkspaceAddonKey } from '../entitlements/addon-catalog';
import type {
  WorkspaceBillingActiveAddonRow,
  WorkspaceBillingAddonCatalogCard,
  WorkspaceBillingTopUpRow,
  WorkspaceBillingTrainedKnowledgeBotUsage,
  WorkspaceBillingUsageSummary,
} from './workspace-billing-summary.types';

export type WorkspaceAddonDbRow = {
  addonKey: string;
  targetBotId?: string | null;
  targetBotName?: string | null;
  status: string;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
};

export type AddonCatalogDisplayStatus =
  | 'active'
  | 'inactive'
  | 'cancel_at_period_end'
  | 'expired'
  | 'cancelled';

const ADDON_DESCRIPTIONS: Record<WorkspaceAddonKey, string> = {
  ai_credits_1000:
    'Extra credits are used only after your monthly plan credits are used. They do not replace your monthly credits and do not reduce next month’s included plan credits.',
  extra_bot: 'Adds one extra agent to this workspace while the add-on subscription is active.',
  remove_branding: 'Lets you hide “Powered by Assistrio” from your widget while active.',
};

export function resolveAddonCatalogDisplayStatus(input: {
  addonKey: WorkspaceAddonKey;
  rows: WorkspaceAddonDbRow[];
  now?: Date;
}): AddonCatalogDisplayStatus {
  const now = input.now ?? new Date();
  const matching = input.rows.filter((row) => row.addonKey === input.addonKey);

  if (matching.length === 0) return 'inactive';

  const activeRow = matching.find((row) => row.status === 'active');
  if (activeRow) {
    if (activeRow.cancelAtPeriodEnd) return 'cancel_at_period_end';
    return 'active';
  }

  const latest = matching[0];
  const periodEnd = latest.currentPeriodEnd ? new Date(latest.currentPeriodEnd) : null;
  if (latest.status === 'cancelled' && periodEnd && periodEnd > now) {
    return 'cancel_at_period_end';
  }
  if (latest.status === 'expired' || latest.status === 'cancelled') {
    return latest.status === 'expired' ? 'expired' : 'cancelled';
  }
  return 'inactive';
}

export function buildAddonEffectLabel(input: {
  addonKey: WorkspaceAddonKey;
  status: AddonCatalogDisplayStatus;
  usage: WorkspaceBillingUsageSummary;
  targetBotId?: string | null;
  targetBotName?: string | null;
  topUps?: WorkspaceBillingTopUpRow[];
}): string | null {
  if (input.addonKey === 'ai_credits_1000') {
    const purchased = (input.topUps ?? []).reduce((sum, row) => sum + row.creditsPurchased, 0);
    const remaining = input.usage.aiCredits.topUpCreditsRemaining ?? 0;
    if (purchased <= 0 && remaining <= 0) return null;
    return `Purchased ${purchased.toLocaleString()} · ${remaining.toLocaleString()} remaining`;
  }

  if (input.status === 'inactive') return null;

  if (input.addonKey === 'extra_bot') {
    return `+1 agent (limit ${input.usage.bots.limit})`;
  }

  if (input.addonKey === 'remove_branding') {
    return 'Branding hidden on widget';
  }

  return null;
}

function resolveBotKnowledgeUsage(
  perBot: WorkspaceBillingTrainedKnowledgeBotUsage[],
  targetBotId?: string | null,
): WorkspaceBillingTrainedKnowledgeBotUsage | null {
  const id = String(targetBotId ?? '').trim();
  if (!id) return perBot[0] ?? null;
  return perBot.find((row) => row.botId === id) ?? null;
}

export function buildEnrichedAddonCatalog(input: {
  checkoutAvailableForAddon: (addonKey: WorkspaceAddonKey) => boolean;
  addonRows: WorkspaceAddonDbRow[];
  usage: WorkspaceBillingUsageSummary;
  topUps: WorkspaceBillingTopUpRow[];
  now?: Date;
}): WorkspaceBillingAddonCatalogCard[] {
  return WORKSPACE_ADDON_CATALOG.map((addon) => {
    const matchingRows = input.addonRows.filter((row) => row.addonKey === addon.key);
    const status = resolveAddonCatalogDisplayStatus({
      addonKey: addon.key,
      rows: matchingRows,
      now: input.now,
    });
    const primaryRow =
      matchingRows.find((row) => row.status === 'active') ??
      matchingRows.find((row) => row.cancelAtPeriodEnd) ??
      matchingRows[0];

    return {
      key: addon.key,
      name: addon.name,
      billingInterval: addon.billingInterval,
      priceUsd: addon.priceUsd,
      scope: addon.scope,
      checkoutAvailable: input.checkoutAvailableForAddon(addon.key),
      description: ADDON_DESCRIPTIONS[addon.key],
      active: status === 'active' || status === 'cancel_at_period_end',
      status,
      targetBotId: primaryRow?.targetBotId ?? null,
      targetBotName: primaryRow?.targetBotName ?? null,
      currentPeriodEnd: primaryRow?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: Boolean(primaryRow?.cancelAtPeriodEnd),
      effectLabel: buildAddonEffectLabel({
        addonKey: addon.key,
        status,
        usage: input.usage,
        targetBotId: primaryRow?.targetBotId,
        targetBotName: primaryRow?.targetBotName,
        topUps: input.topUps,
      }),
    };
  });
}

export function mapAddonRowsForSummary(input: {
  addonRows: WorkspaceAddonDbRow[];
  now?: Date;
  usage: WorkspaceBillingUsageSummary;
  topUps: WorkspaceBillingTopUpRow[];
}): WorkspaceBillingActiveAddonRow[] {
  const now = input.now ?? new Date();
  return input.addonRows
    .filter((row) => !isLegacyKbAddonKey(row.addonKey))
    .filter((row) => {
      if (row.status === 'active') return true;
      const end = row.currentPeriodEnd ? new Date(row.currentPeriodEnd) : null;
      return Boolean(end && end > now);
    })
    .map((row) => {
      const catalog = WORKSPACE_ADDON_CATALOG.find((item) => item.key === row.addonKey);
      const addonKey = row.addonKey as WorkspaceAddonKey;
      const displayStatus = resolveAddonCatalogDisplayStatus({
        addonKey,
        rows: [row],
        now,
      });

      return {
        addonKey: row.addonKey,
        name: catalog?.name ?? row.addonKey,
        status: displayStatus,
        targetBotId: row.targetBotId ?? null,
        targetBotName: row.targetBotName ?? null,
        billingInterval: catalog?.billingInterval ?? 'monthly',
        priceUsd: catalog?.priceUsd ?? 0,
        currentPeriodStart: row.currentPeriodStart ?? null,
        currentPeriodEnd: row.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
        effectLabel: buildAddonEffectLabel({
          addonKey,
          status: displayStatus,
          usage: input.usage,
          targetBotId: row.targetBotId,
          targetBotName: row.targetBotName,
          topUps: input.topUps,
        }),
      };
    });
}
