import type { WorkspaceBillingPlanCatalogCard } from '@/types/billing';

export const PLAN_KEYS = ['free', 'starter', 'pro'] as const;
export type BillingPlanKey = (typeof PLAN_KEYS)[number];

export const PLAN_COLUMN_LABELS: Record<BillingPlanKey, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
};

export const KB_STORAGE_INFO_NOTES = [
  'Trained knowledge storage counts the extracted text your AI learns from — not the original file size. A 20 MB PDF may use much less trained knowledge storage after text extraction.',
  'Upload files up to 20 MB each. Your plan limit is based on extracted text, so the number of files depends on how much readable text is inside them.',
] as const;

export const TRAINED_KNOWLEDGE_UPLOAD_HELPER =
  'Upload files up to 20 MB each. Trained knowledge storage counts extracted text, not original file size.';

export const MESSAGING_CREDITS_NOTE = 'Voice, dictation, and chat use AI credits.';

export const TRIAL_CREDITS_NOTE = 'Trial credits do not renew.';

export type PlanComparisonCell = string;

export type PlanComparisonRow = {
  feature: string;
  values: Record<BillingPlanKey, PlanComparisonCell>;
  /** Shown on hover when the feature label uses a dotted underline. */
  featureHint?: readonly string[];
};

function planByKey(
  catalog: WorkspaceBillingPlanCatalogCard[],
  key: BillingPlanKey,
): WorkspaceBillingPlanCatalogCard | undefined {
  return catalog.find((plan) => plan.key === key);
}

function formatPlanPriceShort(priceMonthly: number | null | undefined): string {
  const price = Number(priceMonthly ?? 0);
  if (!Number.isFinite(price) || price <= 0) return '$0/mo';
  return `$${price.toLocaleString()}/mo`;
}

function formatAiCreditsCell(planKey: BillingPlanKey, credits: number): string {
  const formatted = credits.toLocaleString();
  if (planKey === 'free') return `${formatted} trial credits total`;
  return `${formatted} AI credits / month`;
}

function formatAnalyticsHistoryCell(days: number | null | undefined): string {
  if (days == null) return 'Unlimited history';
  return `${days} days history`;
}

function formatExportReportsCell(enabled: boolean | null | undefined): string {
  return enabled ? 'Included' : '—';
}

function formatApproxTextCapacity(mb: number): string {
  return `~${mb.toLocaleString()}M characters`;
}

function columnValue(
  catalog: WorkspaceBillingPlanCatalogCard[],
  key: BillingPlanKey,
  pick: (plan: WorkspaceBillingPlanCatalogCard) => string,
): string {
  const plan = planByKey(catalog, key);
  return plan ? pick(plan) : '—';
}

export function buildMainPlanComparisonRows(
  catalog: WorkspaceBillingPlanCatalogCard[],
): PlanComparisonRow[] {
  return [
    {
      feature: 'Price',
      values: {
        free: columnValue(catalog, 'free', (plan) => formatPlanPriceShort(plan.priceMonthly)),
        starter: columnValue(catalog, 'starter', (plan) => formatPlanPriceShort(plan.priceMonthly)),
        pro: columnValue(catalog, 'pro', (plan) => formatPlanPriceShort(plan.priceMonthly)),
      },
    },
    {
      feature: 'Agents',
      values: {
        free: columnValue(catalog, 'free', (plan) => String(plan.botLimit)),
        starter: columnValue(catalog, 'starter', (plan) => String(plan.botLimit)),
        pro: columnValue(catalog, 'pro', (plan) => String(plan.botLimit)),
      },
    },
    {
      feature: 'Workspace members',
      values: {
        free: columnValue(catalog, 'free', (plan) => String(plan.memberLimit)),
        starter: columnValue(catalog, 'starter', (plan) => String(plan.memberLimit)),
        pro: columnValue(catalog, 'pro', (plan) => String(plan.memberLimit)),
      },
    },
    {
      feature: 'AI credits / month',
      featureHint: [TRIAL_CREDITS_NOTE],
      values: {
        free: columnValue(catalog, 'free', (plan) => formatAiCreditsCell('free', plan.monthlyAiCredits)),
        starter: columnValue(catalog, 'starter', (plan) =>
          formatAiCreditsCell('starter', plan.monthlyAiCredits),
        ),
        pro: columnValue(catalog, 'pro', (plan) => formatAiCreditsCell('pro', plan.monthlyAiCredits)),
      },
    },
    {
      feature: 'Trained knowledge storage / bot',
      featureHint: [TRAINED_KNOWLEDGE_UPLOAD_HELPER],
      values: {
        free: columnValue(catalog, 'free', (plan) => `${plan.kbStorageMbPerBot} MB`),
        starter: columnValue(catalog, 'starter', (plan) => `${plan.kbStorageMbPerBot} MB`),
        pro: columnValue(catalog, 'pro', (plan) => `${plan.kbStorageMbPerBot} MB`),
      },
    },
    {
      feature: 'Approx trained text capacity',
      values: {
        free: columnValue(catalog, 'free', (plan) => formatApproxTextCapacity(plan.kbStorageMbPerBot)),
        starter: columnValue(catalog, 'starter', (plan) =>
          formatApproxTextCapacity(plan.kbStorageMbPerBot),
        ),
        pro: columnValue(catalog, 'pro', (plan) => formatApproxTextCapacity(plan.kbStorageMbPerBot)),
      },
    },
    {
      feature: 'File upload size',
      values: {
        free: 'Up to 20 MB / file',
        starter: 'Up to 20 MB / file',
        pro: 'Up to 20 MB / file',
      },
    },
    {
      feature: 'Analytics history',
      values: {
        free: columnValue(catalog, 'free', (plan) =>
          formatAnalyticsHistoryCell(plan.analyticsHistoryDays),
        ),
        starter: columnValue(catalog, 'starter', (plan) =>
          formatAnalyticsHistoryCell(plan.analyticsHistoryDays),
        ),
        pro: columnValue(catalog, 'pro', (plan) =>
          formatAnalyticsHistoryCell(plan.analyticsHistoryDays),
        ),
      },
    },
    {
      feature: 'Export reports',
      values: {
        free: columnValue(catalog, 'free', (plan) => formatExportReportsCell(plan.canExportReports)),
        starter: columnValue(catalog, 'starter', (plan) =>
          formatExportReportsCell(plan.canExportReports),
        ),
        pro: columnValue(catalog, 'pro', (plan) => formatExportReportsCell(plan.canExportReports)),
      },
    },
    {
      feature: 'Remove branding',
      values: {
        free: 'Available on paid plans',
        starter: 'Coming soon',
        pro: 'Coming soon',
      },
    },
    {
      feature: 'Extra bots',
      values: {
        free: 'Available on paid plans',
        starter: 'Coming soon',
        pro: 'Coming soon',
      },
    },
    {
      feature: 'Extra trained knowledge storage',
      values: {
        free: 'Available on paid plans',
        starter: 'Coming soon',
        pro: 'Coming soon',
      },
    },
  ];
}

export const TRAINED_KNOWLEDGE_GUIDE_ROWS: Array<{
  plan: string;
  guide: string;
}> = [
  {
    plan: 'Free',
    guide: 'Good for FAQs, snippets, small product docs, and a few lightweight PDFs',
  },
  {
    plan: 'Starter',
    guide: 'Good for a complete help center, policies, product docs, and datasheets',
  },
  {
    plan: 'Pro',
    guide:
      'Good for larger support knowledge bases, multiple docs, tables, and richer product content',
  },
];

const CORE_LIMITS_FEATURES = [
  'Agents',
  'Workspace members',
  'AI credits / month',
  'Trained knowledge storage / bot',
  'File upload size',
] as const;

export const FEATURE_COMPARISON_GROUP_DEFS: Array<{
  id: string;
  title: string;
  features: readonly string[];
}> = [
  { id: 'core-limits', title: 'Core limits', features: CORE_LIMITS_FEATURES },
  {
    id: 'analytics-exports',
    title: 'Analytics & exports',
    features: [
      'History',
      'Analytics',
      'Topic analytics',
      'Sentiment analytics',
      'Source / channel analytics',
      'Device / location analytics',
      'AI usage analytics',
      'Coverage',
      'Export reports',
      'Export leads',
    ],
  },
  {
    id: 'knowledge-base',
    title: 'Knowledge base',
    features: [
      'File uploads to knowledge base',
      'Snippets',
      'Q&A knowledge',
      'Datasheets / CSV import',
    ],
  },
  {
    id: 'widget-sharing',
    title: 'Widget & sharing',
    features: [
      'Brand color customization',
      'Deep agent UI customization',
      'Welcome message customization',
      'Auto-train agent',
      'Share preview link',
      'Iframe/embed widget',
      'Allowed website origins',
      'Powered by Assistrio branding',
      'Remove branding',
    ],
  },
  {
    id: 'messaging',
    title: 'Messaging',
    features: ['Voice messages', 'Dictation', 'Language adaptation', 'Attachments'],
  },
  {
    id: 'collaboration-support',
    title: 'Collaboration & support',
    features: [
      'Lead capture',
      'Lead management',
      'Per-person agent access',
      'Workspace members/invites',
      'Priority support',
    ],
  },
];

/** Grouped feature rows for the flat comparison table. */
export const PLAN_COMPARISON_TABLE_GROUP_DEFS: Array<{
  id: string;
  title: string;
  features: readonly string[];
}> = [
  {
    id: 'core-limits',
    title: 'Core limits',
    features: [
      'Agents',
      'Workspace members',
      'AI credits',
      'Trained knowledge storage / bot',
    ],
  },
  {
    id: 'analytics-exports',
    title: 'Analytics & exports',
    features: [
      'Basic analytics',
      'Topic analytics',
      'Sentiment analytics',
      'Export reports',
    ],
  },
  {
    id: 'leads',
    title: 'Leads',
    features: ['Lead capture & management'],
  },
  {
    id: 'widget-sharing',
    title: 'Widget & sharing',
    features: [
      'Widget customization',
      'Auto-train agent',
      'Share preview link',
      'Iframe/embed widget',
      'Remove branding',
    ],
  },
  {
    id: 'messaging',
    title: 'Messaging',
    features: ['Voice messages', 'Dictation', 'Language adaptation', 'Attachments'],
  },
  {
    id: 'collaboration-support',
    title: 'Collaboration & support',
    features: ['Member-level access', 'Agent-level access', 'Priority support'],
  },
];

const TABLE_FEATURE_ALIASES: Record<string, string> = {
  'AI credits': 'AI credits / month',
  'Trained knowledge storage / bot': 'Trained knowledge storage / bot',
};

const TABLE_FEATURE_HINTS: Record<string, readonly string[]> = {
  'Basic analytics': [
    'Conversations Coverage',
    'Leads Coverage',
    'Source / channel analytics',
    'Device / location analytics',
    'AI Credits Usage',
  ],
  'Export reports': [
    'Basic analytics',
    'Topic analytics',
    'Sentiment analytics',
    'Conversations Coverage',
    'Leads Coverage',
  ],
  'Widget customization': [
    'Brand color customization',
    'Deep agent UI customization',
    'Welcome message customization',
    'Suggested message',
  ],
};

function pickComparisonRows(
  catalog: WorkspaceBillingPlanCatalogCard[],
  features: readonly string[],
): PlanComparisonRow[] {
  const mainRows = new Map(buildMainPlanComparisonRows(catalog).map((row) => [row.feature, row]));
  const featureRows = new Map(FEATURE_COMPARISON_ROWS.map((row) => [row.feature, row]));

  return features.flatMap((feature): PlanComparisonRow[] => {
    const lookupKey = TABLE_FEATURE_ALIASES[feature] ?? feature;
    const row = mainRows.get(lookupKey) ?? featureRows.get(lookupKey) ?? featureRows.get(feature);
    if (!row) return [];

    const featureHint = row.featureHint ?? TABLE_FEATURE_HINTS[feature];
    return [
      {
        ...row,
        feature,
        ...(featureHint ? { featureHint } : {}),
      },
    ];
  });
}

export function buildFeatureComparisonGroups(
  catalog: WorkspaceBillingPlanCatalogCard[],
): Array<{ id: string; title: string; rows: PlanComparisonRow[] }> {
  return FEATURE_COMPARISON_GROUP_DEFS.map((group) => ({
    id: group.id,
    title: group.title,
    rows: pickComparisonRows(catalog, group.features),
  }));
}

const PLAN_COMPARISON_GROUP_NOTES: Record<string, string> = {
  'core-limits': TRAINED_KNOWLEDGE_UPLOAD_HELPER,
  messaging: MESSAGING_CREDITS_NOTE,
};

export type PlanComparisonTableGroup = {
  id: string;
  title: string;
  rows: PlanComparisonRow[];
  note?: string;
};

export function buildPlanComparisonTableGroups(
  catalog: WorkspaceBillingPlanCatalogCard[],
): PlanComparisonTableGroup[] {
  return PLAN_COMPARISON_TABLE_GROUP_DEFS.map((group) => ({
    id: group.id,
    title: group.title,
    rows: pickComparisonRows(catalog, group.features),
    note: PLAN_COMPARISON_GROUP_NOTES[group.id],
  })).filter((group) => group.rows.length > 0);
}

/** @deprecated Use buildPlanComparisonTableGroups instead. */
export function buildPlanComparisonTableRows(
  catalog: WorkspaceBillingPlanCatalogCard[],
): PlanComparisonRow[] {
  return buildPlanComparisonTableGroups(catalog).flatMap((group) => group.rows);
}

export const FEATURE_COMPARISON_ROWS: PlanComparisonRow[] = [
  {
    feature: 'Widget customization',
    values: { free: 'Advanced', starter: 'Advanced', pro: 'Advanced' },
  },
  {
    feature: 'Brand color customization',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Deep agent UI customization',
    values: { free: 'Advanced', starter: 'Advanced', pro: 'Advanced' },
  },
  {
    feature: 'Welcome message customization',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Lead capture & management',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Lead capture',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Lead management',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Export leads',
    values: { free: '—', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Basic analytics',
    values: { free: '7 days', starter: 'Unlimited', pro: 'Unlimited' },
  },
  {
    feature: 'Topic analytics',
    values: { free: '7 days', starter: 'Unlimited', pro: 'Unlimited' },
  },
  {
    feature: 'Sentiment analytics',
    values: { free: '7 days', starter: 'Unlimited', pro: 'Unlimited' },
  },
  {
    feature: 'AI usage analytics',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Voice messages',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Dictation',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Auto-train agent',
    values: { free: '—', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Language adaptation',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Attachments',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'File uploads to knowledge base',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Snippets',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Q&A knowledge',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Datasheets / CSV import',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Share preview link',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Iframe/embed widget',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Allowed website origins',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Member-level access',
    values: { free: '—', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Agent-level access',
    values: { free: '—', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Per-person agent access',
    values: { free: 'Included', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Workspace members/invites',
    values: { free: '—', starter: 'Included', pro: 'Included' },
  },
  {
    feature: 'Powered by Assistrio branding',
    values: { free: 'Shown', starter: 'Shown', pro: 'Shown' },
  },
  {
    feature: 'Remove branding',
    values: {
      free: 'Available on paid plans',
      starter: 'Coming soon',
      pro: 'Coming soon',
    },
  },
  {
    feature: 'Priority support',
    values: { free: '—', starter: 'Standard', pro: 'Priority' },
  },
];
