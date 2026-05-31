import type { AppConfig } from '../config/config.factory';
import { configFactory } from '../config/config.factory';
import type { WorkspaceAddonKey } from '../entitlements/addon-catalog';
import type { BillingInterval } from './billing-interval.types';
import type { BillingAddonCheckoutKey, BillingPlanCheckoutKey, BillingTopUpCheckoutKey } from './billing-provider.types';

export type PlanVariantIds = Record<BillingInterval, string>;
export type AddonVariantIds = Record<BillingInterval, string>;

export type LemonSqueezyBillingConfig = {
  apiKey: string;
  storeId: string;
  webhookSecret: string;
  customerAppBaseUrl: string;
  variantIds: {
    starter: PlanVariantIds;
    pro: PlanVariantIds;
    extra_bot: AddonVariantIds;
    remove_branding: AddonVariantIds;
    ai_credits_1000: string;
    ai_credits_auto_topup: string;
  };
};

const LEMON_BASE_CHECKOUT_ENV_KEYS = [
  'LEMON_SQUEEZY_API_KEY',
  'LEMON_SQUEEZY_STORE_ID',
  'CUSTOMER_APP_BASE_URL',
] as const;

const PLAN_VARIANT_ENV: Record<
  BillingPlanCheckoutKey,
  Record<BillingInterval, keyof AppConfig>
> = {
  starter: {
    monthly: 'lemonSqueezyStarterMonthlyVariantId',
    yearly: 'lemonSqueezyStarterYearlyVariantId',
  },
  pro: {
    monthly: 'lemonSqueezyProMonthlyVariantId',
    yearly: 'lemonSqueezyProYearlyVariantId',
  },
};

const ADDON_VARIANT_ENV: Record<
  BillingAddonCheckoutKey,
  Record<BillingInterval, keyof AppConfig>
> = {
  extra_bot: {
    monthly: 'lemonSqueezyAddonExtraBotMonthlyVariantId',
    yearly: 'lemonSqueezyAddonExtraBotYearlyVariantId',
  },
  remove_branding: {
    monthly: 'lemonSqueezyAddonRemoveBrandingMonthlyVariantId',
    yearly: 'lemonSqueezyAddonRemoveBrandingYearlyVariantId',
  },
};

const TOP_UP_VARIANT_ENV: Record<BillingTopUpCheckoutKey, keyof AppConfig> = {
  ai_credits_1000: 'lemonSqueezyTopup1000CreditsVariantId',
};

const ENV_KEY_BY_CONFIG_FIELD: Partial<Record<keyof AppConfig, string>> = {
  lemonSqueezyApiKey: 'LEMON_SQUEEZY_API_KEY',
  lemonSqueezyStoreId: 'LEMON_SQUEEZY_STORE_ID',
  customerAppBaseUrl: 'CUSTOMER_APP_BASE_URL',
  lemonSqueezyStarterMonthlyVariantId: 'LEMON_SQUEEZY_STARTER_MONTHLY_VARIANT_ID',
  lemonSqueezyStarterYearlyVariantId: 'LEMON_SQUEEZY_STARTER_YEARLY_VARIANT_ID',
  lemonSqueezyProMonthlyVariantId: 'LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID',
  lemonSqueezyProYearlyVariantId: 'LEMON_SQUEEZY_PRO_YEARLY_VARIANT_ID',
  lemonSqueezyAddonExtraBotMonthlyVariantId: 'LEMON_SQUEEZY_ADDON_EXTRA_BOT_MONTHLY_VARIANT_ID',
  lemonSqueezyAddonExtraBotYearlyVariantId: 'LEMON_SQUEEZY_ADDON_EXTRA_BOT_YEARLY_VARIANT_ID',
  lemonSqueezyAddonRemoveBrandingMonthlyVariantId:
    'LEMON_SQUEEZY_ADDON_REMOVE_BRANDING_MONTHLY_VARIANT_ID',
  lemonSqueezyAddonRemoveBrandingYearlyVariantId:
    'LEMON_SQUEEZY_ADDON_REMOVE_BRANDING_YEARLY_VARIANT_ID',
  lemonSqueezyTopup1000CreditsVariantId: 'LEMON_SQUEEZY_TOPUP_1000_CREDITS_VARIANT_ID',
  lemonSqueezyAutoTopupVariantId: 'LEMON_SQUEEZY_AUTO_TOPUP_VARIANT_ID',
};

function readVariantId(config: AppConfig, field: keyof AppConfig): string {
  return String(config[field] ?? '').trim();
}

function readPlanVariantIds(config: AppConfig, planKey: BillingPlanCheckoutKey): PlanVariantIds {
  const fields = PLAN_VARIANT_ENV[planKey];
  return {
    monthly: readVariantId(config, fields.monthly),
    yearly: readVariantId(config, fields.yearly),
  };
}

function readAddonVariantIds(config: AppConfig, addonKey: BillingAddonCheckoutKey): AddonVariantIds {
  const fields = ADDON_VARIANT_ENV[addonKey];
  return {
    monthly: readVariantId(config, fields.monthly),
    yearly: readVariantId(config, fields.yearly),
  };
}

/** Merge runtime ConfigService values over env defaults for Lemon billing fields. */
export function readMergedBillingAppConfig(
  configService: { get: <T = string>(key: string) => T | undefined },
): AppConfig {
  const base = configFactory();
  const get = (key: keyof AppConfig): string =>
    String(configService.get(String(key)) ?? base[key] ?? '').trim();

  return {
    ...base,
    lemonSqueezyApiKey: get('lemonSqueezyApiKey'),
    lemonSqueezyStoreId: get('lemonSqueezyStoreId'),
    lemonSqueezyWebhookSecret: get('lemonSqueezyWebhookSecret'),
    customerAppBaseUrl: get('customerAppBaseUrl'),
    lemonSqueezyStarterMonthlyVariantId: get('lemonSqueezyStarterMonthlyVariantId'),
    lemonSqueezyStarterYearlyVariantId: get('lemonSqueezyStarterYearlyVariantId'),
    lemonSqueezyProMonthlyVariantId: get('lemonSqueezyProMonthlyVariantId'),
    lemonSqueezyProYearlyVariantId: get('lemonSqueezyProYearlyVariantId'),
    lemonSqueezyAddonExtraBotMonthlyVariantId: get('lemonSqueezyAddonExtraBotMonthlyVariantId'),
    lemonSqueezyAddonExtraBotYearlyVariantId: get('lemonSqueezyAddonExtraBotYearlyVariantId'),
    lemonSqueezyAddonRemoveBrandingMonthlyVariantId: get('lemonSqueezyAddonRemoveBrandingMonthlyVariantId'),
    lemonSqueezyAddonRemoveBrandingYearlyVariantId: get('lemonSqueezyAddonRemoveBrandingYearlyVariantId'),
    lemonSqueezyTopup1000CreditsVariantId: get('lemonSqueezyTopup1000CreditsVariantId'),
    lemonSqueezyAutoTopupVariantId: get('lemonSqueezyAutoTopupVariantId'),
  };
}

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

export function getRequiredEnvKeysForPlanCheckout(
  planKey: BillingPlanCheckoutKey,
  billingInterval: BillingInterval = 'monthly',
): string[] {
  const variantKey = ENV_KEY_BY_CONFIG_FIELD[PLAN_VARIANT_ENV[planKey][billingInterval]];
  return variantKey ? [...LEMON_BASE_CHECKOUT_ENV_KEYS, variantKey] : [...LEMON_BASE_CHECKOUT_ENV_KEYS];
}

export function getRequiredEnvKeysForAddonCheckout(
  addonKey: BillingAddonCheckoutKey,
  billingInterval: BillingInterval = 'monthly',
): string[] {
  const variantKey = ENV_KEY_BY_CONFIG_FIELD[ADDON_VARIANT_ENV[addonKey][billingInterval]];
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
      starter: readPlanVariantIds(config, 'starter'),
      pro: readPlanVariantIds(config, 'pro'),
      extra_bot: readAddonVariantIds(config, 'extra_bot'),
      remove_branding: readAddonVariantIds(config, 'remove_branding'),
      ai_credits_1000: readVariantId(config, TOP_UP_VARIANT_ENV.ai_credits_1000),
      ai_credits_auto_topup: readVariantId(config, 'lemonSqueezyAutoTopupVariantId'),
    },
  };
}

export function isAutoTopUpCheckoutAvailable(config: AppConfig): boolean {
  if (!hasLemonBaseCheckoutConfig(config)) return false;
  return Boolean(readVariantId(config, 'lemonSqueezyAutoTopupVariantId'));
}

export function mapAutoTopUpVariantId(config: LemonSqueezyBillingConfig): string {
  const variantId = config.variantIds.ai_credits_auto_topup?.trim();
  if (!variantId) {
    throw new Error('lemon_variant_not_configured:auto_top_up:ai_credits_auto_topup');
  }
  return variantId;
}

export function isAutoTopUpVariantId(
  config: LemonSqueezyBillingConfig | null | undefined,
  variantId: string | null | undefined,
): boolean {
  const id = String(variantId ?? '').trim();
  if (!id || !config) return false;
  return id === String(config.variantIds.ai_credits_auto_topup ?? '').trim();
}

/** True when Lemon base checkout env is present (does not require variant IDs or webhook secret). */
export function isBillingCheckoutConfigured(config: AppConfig): boolean {
  return hasLemonBaseCheckoutConfig(config);
}

export function isBillingWebhookConfigured(config: AppConfig): boolean {
  const secret = config.lemonSqueezyWebhookSecret?.trim() ?? '';
  return Boolean(secret);
}

export function isPlanCheckoutAvailable(
  config: AppConfig,
  planKey: BillingPlanCheckoutKey,
  billingInterval: BillingInterval = 'monthly',
): boolean {
  if (!hasLemonBaseCheckoutConfig(config)) return false;
  const field = PLAN_VARIANT_ENV[planKey][billingInterval];
  return Boolean(readVariantId(config, field));
}

export function isAddonCheckoutAvailable(
  config: AppConfig,
  addonKey: BillingAddonCheckoutKey,
  billingInterval: BillingInterval = 'monthly',
): boolean {
  if (!hasLemonBaseCheckoutConfig(config)) return false;
  const field = ADDON_VARIANT_ENV[addonKey][billingInterval];
  return Boolean(readVariantId(config, field));
}

export function isTopUpCheckoutAvailable(config: AppConfig, topUpKey: BillingTopUpCheckoutKey): boolean {
  if (!hasLemonBaseCheckoutConfig(config)) return false;
  const field = TOP_UP_VARIANT_ENV[topUpKey];
  return Boolean(readVariantId(config, field));
}

/** Catalog add-on row checkout: top-up SKU uses top-up variant env only. */
export function isWorkspaceAddonCatalogCheckoutAvailable(
  config: AppConfig,
  addonKey: WorkspaceAddonKey,
  billingInterval: BillingInterval = 'monthly',
): boolean {
  if (addonKey === 'ai_credits_1000') {
    return isTopUpCheckoutAvailable(config, 'ai_credits_1000');
  }
  if (addonKey in ADDON_VARIANT_ENV) {
    return isAddonCheckoutAvailable(config, addonKey as BillingAddonCheckoutKey, billingInterval);
  }
  return false;
}

export function mapPlanKeyToVariantId(
  lemonConfig: LemonSqueezyBillingConfig,
  planKey: BillingPlanCheckoutKey,
  billingInterval: BillingInterval = 'monthly',
): string {
  const id = lemonConfig.variantIds[planKey][billingInterval]?.trim() ?? '';
  if (!id) {
    throw new Error(`lemon_variant_not_configured:plan:${planKey}:${billingInterval}`);
  }
  return id;
}

export function mapAddonKeyToVariantId(
  lemonConfig: LemonSqueezyBillingConfig,
  addonKey: BillingAddonCheckoutKey,
  billingInterval: BillingInterval = 'monthly',
): string {
  const id = lemonConfig.variantIds[addonKey][billingInterval]?.trim() ?? '';
  if (!id) {
    throw new Error(`lemon_variant_not_configured:addon:${addonKey}:${billingInterval}`);
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

export function variantIdToPlanKeyAndInterval(
  variantId: string | null | undefined,
  lemonConfig: LemonSqueezyBillingConfig | null | undefined,
): { planKey: BillingPlanCheckoutKey; billingInterval: BillingInterval } | undefined {
  const id = String(variantId ?? '').trim();
  if (!id || !lemonConfig) return undefined;

  for (const planKey of ['starter', 'pro'] as const) {
    for (const billingInterval of ['monthly', 'yearly'] as const) {
      const configured = lemonConfig.variantIds[planKey][billingInterval]?.trim() ?? '';
      if (configured && configured === id) {
        return { planKey, billingInterval };
      }
    }
  }

  return undefined;
}

export function variantIdToAddonCheckoutKey(
  variantId: string | null | undefined,
  lemonConfig: LemonSqueezyBillingConfig | null | undefined,
): BillingAddonCheckoutKey | undefined {
  const match = variantIdToAddonKeyAndInterval(variantId, lemonConfig);
  return match?.addonKey;
}

export function variantIdToAddonKeyAndInterval(
  variantId: string | null | undefined,
  lemonConfig: LemonSqueezyBillingConfig | null | undefined,
): { addonKey: BillingAddonCheckoutKey; billingInterval: BillingInterval } | undefined {
  const id = String(variantId ?? '').trim();
  if (!id || !lemonConfig) return undefined;

  for (const addonKey of ADDON_VARIANT_KEYS) {
    for (const billingInterval of ['monthly', 'yearly'] as const) {
      const configured = lemonConfig.variantIds[addonKey][billingInterval]?.trim() ?? '';
      if (configured && configured === id) {
        return { addonKey, billingInterval };
      }
    }
  }

  return undefined;
}

/** @deprecated Use variantIdToPlanKeyAndInterval */
export function variantIdToPlanCheckoutKey(
  variantId: string | null | undefined,
  lemonConfig: LemonSqueezyBillingConfig | null | undefined,
): BillingPlanCheckoutKey | undefined {
  return variantIdToPlanKeyAndInterval(variantId, lemonConfig)?.planKey;
}
