import type { WorkspaceBillingPlanCatalogCard, WorkspaceBillingSummary } from '@/api/types';

export type BillingUpgradeComparisonRow = {
  label: string;
  fromValue: string;
  toValue: string;
};

export type BillingUpgradeComparisonRowTooltip = {
  label: string;
  fromValue: string;
  toValue: string;
  description: string;
};

const UPGRADE_COMPARISON_ROW_DESCRIPTIONS: Record<string, string> = {
  'AI credits':
    'Monthly credits included with your plan. Used for agent chat replies, voice messages, dictation, and other AI-powered features.',
  'KB storage':
    'Trained knowledge storage per AI agent. More space lets each agent learn from more documents and notes.',
  Members:
    'Workspace members who can access agents, settings, and billing based on their role.',
  Support:
    'How quickly our team responds when you contact support. Priority support is handled ahead of standard requests.',
};

export function buildBillingUpgradeComparisonRowTooltip(
  row: BillingUpgradeComparisonRow,
): BillingUpgradeComparisonRowTooltip {
  return {
    label: row.label,
    fromValue: row.fromValue,
    toValue: row.toValue,
    description:
      UPGRADE_COMPARISON_ROW_DESCRIPTIONS[row.label] ??
      `Upgrade ${row.label.toLowerCase()} from ${row.fromValue} to ${row.toValue}.`,
  };
}

const PLAN_SUPPORT_LABEL: Record<string, string> = {
  free: '—',
  starter: 'Standard',
  pro: 'Priority',
};

const FALLBACK_KB_MB: Record<string, number> = {
  free: 5,
  starter: 15,
  pro: 30,
};

const FALLBACK_MEMBER_LIMIT: Record<string, number> = {
  free: 1,
  starter: 5,
  pro: 10,
};

function findPlanCatalogCard(
  catalog: WorkspaceBillingPlanCatalogCard[],
  planKey: string,
): WorkspaceBillingPlanCatalogCard | undefined {
  return catalog.find((entry) => entry.key === planKey);
}

export function formatBillingUpgradeComparisonHeading(
  fromPlanKey: string,
  toPlanKey: string,
): string {
  const fromLabel = fromPlanKey === 'free' ? 'FREE' : fromPlanKey.toUpperCase();
  return `${fromLabel} → ${toPlanKey.toUpperCase()}`;
}

export function buildBillingUpgradeComparison(
  summary: WorkspaceBillingSummary,
  upgradePlanKey: string,
): BillingUpgradeComparisonRow[] | null {
  const catalog = summary.planCatalog ?? [];
  const upgrade = findPlanCatalogCard(catalog, upgradePlanKey);
  if (!upgrade) return null;

  const currentKey = summary.plan.key;
  const current = findPlanCatalogCard(catalog, currentKey);

  const fromCredits =
    summary.entitlements.isTrialPlan && currentKey === 'free'
      ? summary.entitlements.monthlyAiCredits
      : (current?.monthlyAiCredits ?? summary.entitlements.monthlyAiCredits);

  const fromKb = current?.kbStorageMbPerBot ?? FALLBACK_KB_MB[currentKey] ?? 0;
  const fromMembers =
    current?.memberLimit ?? summary.usage.members.limit ?? FALLBACK_MEMBER_LIMIT[currentKey] ?? 0;

  const fromSupport = PLAN_SUPPORT_LABEL[currentKey] ?? 'Standard';
  const toSupport = PLAN_SUPPORT_LABEL[upgradePlanKey] ?? 'Standard';

  const rows: BillingUpgradeComparisonRow[] = [
    {
      label: 'AI credits',
      fromValue: fromCredits.toLocaleString(),
      toValue: upgrade.monthlyAiCredits.toLocaleString(),
    },
    {
      label: 'KB storage',
      fromValue: `${fromKb} MB`,
      toValue: `${upgrade.kbStorageMbPerBot} MB`,
    },
    {
      label: 'Members',
      fromValue: String(fromMembers),
      toValue: String(upgrade.memberLimit),
    },
  ];

  if (fromSupport !== toSupport) {
    rows.push({
      label: 'Support',
      fromValue: fromSupport,
      toValue: toSupport,
    });
  }

  return rows.filter((row) => row.fromValue !== row.toValue);
}
