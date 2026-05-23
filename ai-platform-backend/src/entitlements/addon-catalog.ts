/**
 * Static add-on catalog for future billing/enforcement. Not wired to purchases in Epic 2 Step 2.
 */
export const WORKSPACE_ADDON_KEYS = [
  'ai_credits_1000',
  'extra_bot',
  'remove_branding',
  'kb_storage_5mb',
  'kb_storage_10mb',
] as const;

export type WorkspaceAddonKey = (typeof WORKSPACE_ADDON_KEYS)[number];

export type WorkspaceAddonDefinition = {
  key: WorkspaceAddonKey;
  name: string;
  /** `one_time` | `monthly` — informational only for now. */
  billingInterval: 'one_time' | 'monthly';
  /** USD list price; billing integration deferred. */
  priceUsd: number;
  scope: 'workspace' | 'bot';
};

export const WORKSPACE_ADDON_CATALOG: readonly WorkspaceAddonDefinition[] = [
  {
    key: 'ai_credits_1000',
    name: '1,000 extra AI credits',
    billingInterval: 'one_time',
    priceUsd: 30,
    scope: 'workspace',
  },
  {
    key: 'extra_bot',
    name: 'Extra bot',
    billingInterval: 'monthly',
    priceUsd: 49,
    scope: 'workspace',
  },
  {
    key: 'remove_branding',
    name: 'Remove Powered by Assistrio',
    billingInterval: 'monthly',
    priceUsd: 20,
    scope: 'workspace',
  },
  {
    key: 'kb_storage_5mb',
    name: '+5 MB KB storage',
    billingInterval: 'monthly',
    priceUsd: 10,
    scope: 'bot',
  },
  {
    key: 'kb_storage_10mb',
    name: '+10 MB KB storage',
    billingInterval: 'monthly',
    priceUsd: 15,
    scope: 'bot',
  },
];
