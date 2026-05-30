import type { AppConfig } from '../config/config.factory';
import type { WorkspaceAddonKey } from '../entitlements/addon-catalog';
import type { BillingAddonCheckoutKey, BillingPlanCheckoutKey, BillingTopUpCheckoutKey } from './billing-provider.types';

export type LemonSqueezyBillingConfig = {
  apiKey: string;
  storeId: string;
  webhookSecret: string;
  customerAppBaseUrl: string;
  variantIds: {
    starter: string;
    pro: string;
    extra_bot: string;
    remove_branding: string;
    ai_credits_1000: string;
  };
};

const LEMON_BASE_CHECKOUT_ENV_KEYS = [
  'LEMON_SQUEEZY_API_KEY',
  'LEMON_SQUEEZY_STORE_ID',
  'CUSTOMER_APP_BASE_URL',
] as const;

const PLAN_VARIANT_ENV: Record<BillingPlanCheckoutKey, keyof AppConfig> = {
  starter: 'lemonSqueezyStarterVariantId',
  pro: 'lemonSqueezyProVariantId',
};

const ADDON_VARIANT_ENV: Record<BillingAddonCheckoutKey, keyof AppConfig> = {
  extra_bot: 'lemonSqueezyAddonExtraBotVariantId',
  remove_branding: 'lemonSqueezyAddonRemoveBrandingVariantId',
};

const TOP_UP_VARIANT_ENV: Record<BillingTopUpCheckoutKey, keyof AppConfig> = {
  ai_credits_1000: 'lemonSqueezyTopup1000CreditsVariantId',
};

const ENV_KEY_BY_CONFIG_FIELD: Partial<Record<keyof AppConfig, string>> = {
  lemonSqueezyApiKey: 'LEMON_SQUEEZY_API_KEY',
  lemonSqueezyStoreId: 'LEMON_SQUEEZY_STORE_ID',
  customerAppBaseUrl: 'CUSTOMER_APP_BASE_URL',
  lemonSqueezyStarterVariantId: 'LEMON_SQUEEZY_STARTER_VARIANT_ID',
  lemonSqueezyProVariantId: 'LEMON_SQUEEZY_PRO_VARIANT_ID',
  lemonSqueezyAddonExtraBotVariantId: 'LEMON_SQUEEZY_ADDON_EXTRA_BOT_VARIANT_ID',
  lemonSqueezyAddonRemoveBrandingVariantId: 'LEMON_SQUEEZY_ADDON_REMOVE_BRANDING_VARIANT_ID',
  lemonSqueezyTopup1000CreditsVariantId: 'LEMON_SQUEEZY_TOPUP_1000_CREDITS_VARIANT_ID',
};

/** Lemon API + store + customer app URL required for any checkout or portal URL. */
export function hasLemonBaseCheckoutConfig(config: AppConfig): boolean {
  return Boolean(
    config.lemonSqueezyApiKey?.trim() &&
      config.lemonSqueezyStoreId?.trim() &&
      config.customerAppBaseUrl?.trim(),
  );
}

export function getRequiredCheckoutEnvKeys(): readonly string[] {
  return LEMON_BASE_CHECKOUT_ENV_KEYS;
}

export function getRequiredEnvKeysForPlanCheckout(planKey: BillingPlanCheckoutKey): string[] {
  const variantKey = ENV_KEY_BY_CONFIG_FIELD[PLAN_VARIANT_ENV[planKey]];
  return variantKey ? [...LEMON_BASE_CHECKOUT_ENV_KEYS, variantKey] : [...LEMON_BASE_CHECKOUT_ENV_KEYS];
}

export function getRequiredEnvKeysForAddonCheckout(addonKey: BillingAddonCheckoutKey): string[] {
  const variantKey = ENV_KEY_BY_CONFIG_FIELD[ADDON_VARIANT_ENV[addonKey]];
  return variantKey ? [...LEMON_BASE_CHECKOUT_ENV_KEYS, variantKey] : [...LEMON_BASE_CHECKOUT_ENV_KEYS];
}

export function getRequiredEnvKeysForTopUpCheckout(topUpKey: BillingTopUpCheckoutKey): string[] {
  const variantKey = ENV_KEY_BY_CONFIG_FIELD[TOP_UP_VARIANT_ENV[topUpKey]];
  return variantKey ? [...LEMON_BASE_CHECKOUT_ENV_KEYS, variantKey] : [...LEMON_BASE_CHECKOUT_ENV_KEYS];
}

export function resolveLemonSqueezyBillingConfig(config: AppConfig): LemonSqueezyBillingConfig | null {
  if (!hasLemonBaseCheckoutConfig(config)) return null;

  return {
    apiKey: config.lemonSqueezyApiKey.trim(),
    storeId: config.lemonSqueezyStoreId.trim(),
    webhookSecret: config.lemonSqueezyWebhookSecret?.trim() ?? '',
    customerAppBaseUrl: config.customerAppBaseUrl.trim(),
    variantIds: {
      starter: config.lemonSqueezyStarterVariantId?.trim() ?? '',
      pro: config.lemonSqueezyProVariantId?.trim() ?? '',
      extra_bot: config.lemonSqueezyAddonExtraBotVariantId?.trim() ?? '',
      remove_branding: config.lemonSqueezyAddonRemoveBrandingVariantId?.trim() ?? '',
      ai_credits_1000: config.lemonSqueezyTopup1000CreditsVariantId?.trim() ?? '',
    },
  };
}

/** True when Lemon base checkout env is present (does not require variant IDs or webhook secret). */
export function isBillingCheckoutConfigured(config: AppConfig): boolean {
  return hasLemonBaseCheckoutConfig(config);
}

export function isBillingWebhookConfigured(config: AppConfig): boolean {
  const secret = config.lemonSqueezyWebhookSecret?.trim() ?? '';
  return Boolean(secret);
}

export function isPlanCheckoutAvailable(config: AppConfig, planKey: BillingPlanCheckoutKey): boolean {
  if (!hasLemonBaseCheckoutConfig(config)) return false;
  const field = PLAN_VARIANT_ENV[planKey];
  return Boolean(String(config[field] ?? '').trim());
}

export function isAddonCheckoutAvailable(config: AppConfig, addonKey: BillingAddonCheckoutKey): boolean {
  if (!hasLemonBaseCheckoutConfig(config)) return false;
  const field = ADDON_VARIANT_ENV[addonKey];
  return Boolean(String(config[field] ?? '').trim());
}

export function isTopUpCheckoutAvailable(config: AppConfig, topUpKey: BillingTopUpCheckoutKey): boolean {
  if (!hasLemonBaseCheckoutConfig(config)) return false;
  const field = TOP_UP_VARIANT_ENV[topUpKey];
  return Boolean(String(config[field] ?? '').trim());
}

/** Catalog add-on row checkout: top-up SKU uses top-up variant env only. */
export function isWorkspaceAddonCatalogCheckoutAvailable(
  config: AppConfig,
  addonKey: WorkspaceAddonKey,
): boolean {
  if (addonKey === 'ai_credits_1000') {
    return isTopUpCheckoutAvailable(config, 'ai_credits_1000');
  }
  if (addonKey in ADDON_VARIANT_ENV) {
    return isAddonCheckoutAvailable(config, addonKey as BillingAddonCheckoutKey);
  }
  return false;
}

export function mapPlanKeyToVariantId(
  lemonConfig: LemonSqueezyBillingConfig,
  planKey: BillingPlanCheckoutKey,
): string {
  const id = lemonConfig.variantIds[planKey]?.trim() ?? '';
  if (!id) {
    throw new Error(`lemon_variant_not_configured:plan:${planKey}`);
  }
  return id;
}

export function mapAddonKeyToVariantId(
  lemonConfig: LemonSqueezyBillingConfig,
  addonKey: BillingAddonCheckoutKey,
): string {
  const id = lemonConfig.variantIds[addonKey]?.trim() ?? '';
  if (!id) {
    throw new Error(`lemon_variant_not_configured:addon:${addonKey}`);
  }
  return id;
}

export function mapTopUpKeyToVariantId(
  lemonConfig: LemonSqueezyBillingConfig,
  topUpKey: BillingTopUpCheckoutKey,
): string {
  const id = lemonConfig.variantIds[topUpKey]?.trim() ?? '';
  if (!id) {
    throw new Error(`lemon_variant_not_configured:top_up:${topUpKey}`);
  }
  return id;
}

const ADDON_VARIANT_KEYS: BillingAddonCheckoutKey[] = ['extra_bot', 'remove_branding'];

export function variantIdToAddonCheckoutKey(
  variantId: string | null | undefined,
  lemonConfig: LemonSqueezyBillingConfig | null | undefined,
): BillingAddonCheckoutKey | undefined {
  const id = String(variantId ?? '').trim();
  if (!id || !lemonConfig) return undefined;

  for (const addonKey of ADDON_VARIANT_KEYS) {
    const configured = lemonConfig.variantIds[addonKey]?.trim() ?? '';
    if (configured && configured === id) return addonKey;
  }

  return undefined;
}
