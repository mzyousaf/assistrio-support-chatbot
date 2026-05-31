import { resolveActiveScheduledIntervalChangeForSummary } from '../entitlements/workspace-scheduled-interval-change.util';
import { WORKSPACE_ADDON_CATALOG, isLegacyKbAddonKey, type WorkspaceAddonKey } from '../entitlements/addon-catalog';
import { parseBillingInterval } from '../billing/billing-interval.types';
import type {
  WorkspaceBillingActiveAddonRow,
  WorkspaceBillingAddonCatalogCard,
  WorkspaceBillingExtraBotAddonInstance,
  WorkspaceBillingTopUpRow,
  WorkspaceBillingTrainedKnowledgeBotUsage,
  WorkspaceBillingUsageSummary,
} from './workspace-billing-summary.types';

export type WorkspaceAddonDbRow = {
  id?: string;
  addonKey: string;
  targetBotId?: string | null;
  targetBotName?: string | null;
  status: string;
  billingInterval?: 'monthly' | 'yearly';
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  scheduledIntervalChange?: {
    fromBillingInterval: 'monthly' | 'yearly';
    toBillingInterval: 'monthly' | 'yearly';
    effectiveAt: string;
    status: 'scheduled' | 'applied' | 'canceled';
  } | null;
};

export type AddonCatalogDisplayStatus =
  | 'active'
  | 'inactive'
  | 'cancel_at_period_end'
  | 'expired'
  | 'cancelled'
  | 'past_due'
  | 'payment_failed';

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

  const paymentIssueRow = matching.find((row) => {
    const status = String(row.status ?? '').trim().toLowerCase();
    return status === 'past_due' || status === 'payment_failed';
  });
  if (paymentIssueRow) return 'past_due';

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
  extraBotActiveCount?: number;
}): string | null {
  if (input.addonKey === 'ai_credits_1000') {
    const purchased = (input.topUps ?? []).reduce((sum, row) => sum + row.creditsPurchased, 0);
    const remaining = input.usage.aiCredits.topUpCreditsRemaining ?? 0;
    if (purchased <= 0 && remaining <= 0) return null;
    return `Purchased ${purchased.toLocaleString()} · ${remaining.toLocaleString()} remaining`;
  }

  if (input.status === 'inactive') return null;

  if (input.addonKey === 'extra_bot') {
    const activeCount = input.extraBotActiveCount ?? 0;
    if (activeCount <= 0) return null;
    if (activeCount === 1) return '+1 agent';
    return `+${activeCount} agents`;
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

function countExtraBotActiveInstances(rows: WorkspaceAddonDbRow[], now: Date): number {
  return rows.filter((row) => row.addonKey === 'extra_bot').filter((row) => {
    const status = resolveAddonCatalogDisplayStatus({
      addonKey: 'extra_bot',
      rows: [row],
      now,
    });
    return status === 'active' || status === 'cancel_at_period_end' || status === 'past_due';
  }).length;
}

function formatScheduledIntervalChangeForSummary(
  row: WorkspaceAddonDbRow,
  now: Date,
): WorkspaceBillingExtraBotAddonInstance['scheduledIntervalChange'] {
  const scheduled = resolveActiveScheduledIntervalChangeForSummary(
    { scheduledIntervalChange: row.scheduledIntervalChange ?? null },
    now,
  );
  if (!scheduled) return null;
  const effectiveAt =
    scheduled.effectiveAt instanceof Date
      ? scheduled.effectiveAt
      : new Date(scheduled.effectiveAt);
  return {
    fromBillingInterval: scheduled.fromBillingInterval,
    toBillingInterval: scheduled.toBillingInterval,
    effectiveAt: Number.isNaN(effectiveAt.getTime()) ? '' : effectiveAt.toISOString(),
    status: scheduled.status,
  };
}

export function mapExtraBotAddonsForSummary(input: {
  addonRows: WorkspaceAddonDbRow[];
  now?: Date;
}): WorkspaceBillingExtraBotAddonInstance[] {
  const now = input.now ?? new Date();
  const catalog = WORKSPACE_ADDON_CATALOG.find((item) => item.key === 'extra_bot');
  const priceUsd = catalog?.priceUsd ?? 0;
  const baseName = catalog?.name ?? 'Extra AI Agent';

  const instances: WorkspaceBillingExtraBotAddonInstance[] = [];

  for (const row of input.addonRows) {
    if (row.addonKey !== 'extra_bot' || !row.id) continue;

    const status = resolveAddonCatalogDisplayStatus({
      addonKey: 'extra_bot',
      rows: [row],
      now,
    });
    if (status !== 'active' && status !== 'cancel_at_period_end' && status !== 'past_due') continue;

    instances.push({
      id: row.id,
      addonKey: 'extra_bot',
      name: baseName,
      status: status === 'past_due' ? 'past_due' : status,
      cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
      billingInterval: parseBillingInterval(row.billingInterval),
      scheduledIntervalChange: formatScheduledIntervalChangeForSummary(row, now),
      scheduledBillingInterval: (() => {
        const scheduled = resolveActiveScheduledIntervalChangeForSummary(
          { scheduledIntervalChange: row.scheduledIntervalChange ?? null },
          now,
        );
        return scheduled?.toBillingInterval;
      })(),
      scheduledBillingIntervalEffectiveDate: (() => {
        const scheduled = resolveActiveScheduledIntervalChangeForSummary(
          { scheduledIntervalChange: row.scheduledIntervalChange ?? null },
          now,
        );
        if (!scheduled) return null;
        const effectiveAt =
          scheduled.effectiveAt instanceof Date
            ? scheduled.effectiveAt
            : new Date(scheduled.effectiveAt);
        return Number.isNaN(effectiveAt.getTime()) ? null : effectiveAt.toISOString();
      })(),
      currentPeriodStart: row.currentPeriodStart ?? null,
      currentPeriodEnd: row.currentPeriodEnd ?? null,
      priceUsd,
      effectLabel: '+1 agent',
    });
  }

  return instances;
}

export function buildEnrichedAddonCatalog(input: {
  checkoutAvailableForAddon: (
    addonKey: WorkspaceAddonKey,
    billingInterval?: 'monthly' | 'yearly',
  ) => boolean;
  addonRows: WorkspaceAddonDbRow[];
  usage: WorkspaceBillingUsageSummary;
  topUps: WorkspaceBillingTopUpRow[];
  creditAutoTopUpPromptEnabled?: boolean;
  now?: Date;
}): WorkspaceBillingAddonCatalogCard[] {
  const now = input.now ?? new Date();
  const extraBotActiveCount = countExtraBotActiveInstances(
    input.addonRows.filter((row) => row.addonKey === 'extra_bot'),
    now,
  );

  return WORKSPACE_ADDON_CATALOG.map((addon) => {
    const matchingRows = input.addonRows.filter((row) => row.addonKey === addon.key);
    const status = resolveAddonCatalogDisplayStatus({
      addonKey: addon.key,
      rows: matchingRows,
      now,
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
      priceYearly: addon.priceYearlyUsd,
      monthlyEquivalentYearly: addon.monthlyEquivalentYearlyUsd,
      yearlyDiscountPercent: addon.yearlyDiscountPercent,
      scope: addon.scope,
      checkoutAvailable:
        addon.billingInterval === 'one_time'
          ? input.checkoutAvailableForAddon(addon.key)
          : input.checkoutAvailableForAddon(addon.key, 'monthly') ||
            input.checkoutAvailableForAddon(addon.key, 'yearly'),
      checkoutAvailableMonthly:
        addon.billingInterval === 'one_time'
          ? undefined
          : input.checkoutAvailableForAddon(addon.key, 'monthly'),
      checkoutAvailableYearly:
        addon.billingInterval === 'one_time'
          ? undefined
          : input.checkoutAvailableForAddon(addon.key, 'yearly'),
      description: ADDON_DESCRIPTIONS[addon.key],
      active: status === 'active' || status === 'cancel_at_period_end' || status === 'past_due',
      status,
      targetBotId: primaryRow?.targetBotId ?? null,
      targetBotName: primaryRow?.targetBotName ?? null,
      currentPeriodEnd: primaryRow?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: Boolean(primaryRow?.cancelAtPeriodEnd),
      ...(addon.billingInterval !== 'one_time' && primaryRow
        ? {
            subscriptionBillingInterval: parseBillingInterval(primaryRow.billingInterval),
            scheduledIntervalChange: (() => {
              const scheduled = resolveActiveScheduledIntervalChangeForSummary(
                { scheduledIntervalChange: primaryRow.scheduledIntervalChange ?? null },
                now,
              );
              if (!scheduled) return null;
              const effectiveAt =
                scheduled.effectiveAt instanceof Date
                  ? scheduled.effectiveAt
                  : new Date(scheduled.effectiveAt);
              return {
                fromBillingInterval: scheduled.fromBillingInterval,
                toBillingInterval: scheduled.toBillingInterval,
                effectiveAt: Number.isNaN(effectiveAt.getTime()) ? '' : effectiveAt.toISOString(),
                status: scheduled.status,
              };
            })(),
          }
        : {}),
      ...(addon.key === 'ai_credits_1000'
        ? { autoTopUpPromptEnabled: Boolean(input.creditAutoTopUpPromptEnabled) }
        : {}),
      effectLabel: buildAddonEffectLabel({
        addonKey: addon.key,
        status,
        usage: input.usage,
        targetBotId: primaryRow?.targetBotId,
        targetBotName: primaryRow?.targetBotName,
        topUps: input.topUps,
        extraBotActiveCount: addon.key === 'extra_bot' ? extraBotActiveCount : undefined,
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
      if (row.status === 'active' || row.status === 'past_due') return true;
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
        billingInterval: parseBillingInterval(row.billingInterval ?? catalog?.billingInterval),
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
