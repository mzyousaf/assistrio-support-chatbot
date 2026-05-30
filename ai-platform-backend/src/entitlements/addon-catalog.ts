/**
 * Static add-on catalog for billing/enforcement.
 */
export const LEGACY_KB_ADDON_KEYS = ['kb_storage_5mb', 'kb_storage_10mb'] as const;

export type LegacyKbAddonKey = (typeof LEGACY_KB_ADDON_KEYS)[number];

export function isLegacyKbAddonKey(key: string | null | undefined): boolean {
  const normalized = String(key ?? '').trim();
  return LEGACY_KB_ADDON_KEYS.includes(normalized as LegacyKbAddonKey);
}

export const WORKSPACE_ADDON_KEYS = [
  'ai_credits_1000',
  'extra_bot',
  'remove_branding',
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
];
