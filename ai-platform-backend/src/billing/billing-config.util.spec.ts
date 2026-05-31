import type { AppConfig } from '../config/config.factory';
import {
  hasLemonBaseCheckoutConfig,
  isAddonCheckoutAvailable,
  isBillingCheckoutConfigured,
  isBillingWebhookConfigured,
  isPlanCheckoutAvailable,
  isTopUpCheckoutAvailable,
  isWorkspaceAddonCatalogCheckoutAvailable,
  resolveLemonSqueezyBillingConfig,
} from './billing-config.util';

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    lemonSqueezyApiKey: 'api-key',
    lemonSqueezyStoreId: 'store-1',
    customerAppBaseUrl: 'https://app.example.com',
    lemonSqueezyWebhookSecret: '',
    lemonSqueezyStarterMonthlyVariantId: '',
    lemonSqueezyStarterYearlyVariantId: '',
    lemonSqueezyProMonthlyVariantId: '',
    lemonSqueezyProYearlyVariantId: '',
    lemonSqueezyAddonExtraBotMonthlyVariantId: '',
    lemonSqueezyAddonExtraBotYearlyVariantId: '',
    lemonSqueezyAddonRemoveBrandingMonthlyVariantId: '',
    lemonSqueezyAddonRemoveBrandingYearlyVariantId: '',
    lemonSqueezyTopup1000CreditsVariantId: '',
    ...overrides,
  } as AppConfig;
}

describe('billing-config.util checkout availability', () => {
  it('Starter monthly checkout is true when monthly variant exists', () => {
    const config = baseConfig({
      lemonSqueezyStarterMonthlyVariantId: 'v-starter-m',
    });
    expect(isPlanCheckoutAvailable(config, 'starter', 'monthly')).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'starter', 'yearly')).toBe(false);
    expect(isPlanCheckoutAvailable(config, 'pro')).toBe(false);
    expect(isAddonCheckoutAvailable(config, 'extra_bot')).toBe(false);
    expect(resolveLemonSqueezyBillingConfig(config)?.variantIds.starter.monthly).toBe('v-starter-m');
  });

  it('Starter yearly checkout is true when yearly variant exists', () => {
    const config = baseConfig({
      lemonSqueezyStarterYearlyVariantId: 'v-starter-y',
    });
    expect(isPlanCheckoutAvailable(config, 'starter', 'yearly')).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'starter', 'monthly')).toBe(false);
  });

  it('Pro checkout is independent per interval', () => {
    const config = baseConfig({
      lemonSqueezyProMonthlyVariantId: 'v-pro-m',
      lemonSqueezyProYearlyVariantId: 'v-pro-y',
    });
    expect(isPlanCheckoutAvailable(config, 'pro', 'monthly')).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'pro', 'yearly')).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'starter')).toBe(false);
  });

  it('add-on availability is independent per interval', () => {
    const config = baseConfig({
      lemonSqueezyAddonExtraBotMonthlyVariantId: 'v-bot-m',
      lemonSqueezyAddonRemoveBrandingYearlyVariantId: 'v-branding-y',
    });
    expect(isAddonCheckoutAvailable(config, 'extra_bot', 'monthly')).toBe(true);
    expect(isAddonCheckoutAvailable(config, 'extra_bot', 'yearly')).toBe(false);
    expect(isAddonCheckoutAvailable(config, 'remove_branding', 'yearly')).toBe(true);
  });

  it('top-up ai_credits_1000 only requires top-up variant env', () => {
    const config = baseConfig({
      lemonSqueezyTopup1000CreditsVariantId: 'v-topup',
    });
    expect(isTopUpCheckoutAvailable(config, 'ai_credits_1000')).toBe(true);
    expect(isAddonCheckoutAvailable(config, 'extra_bot')).toBe(false);
    expect(isWorkspaceAddonCatalogCheckoutAvailable(config, 'ai_credits_1000')).toBe(true);
    expect(isWorkspaceAddonCatalogCheckoutAvailable(config, 'extra_bot')).toBe(false);
  });

  it('webhook secret missing does not disable checkout or base config', () => {
    const config = baseConfig({
      lemonSqueezyWebhookSecret: '',
      lemonSqueezyStarterMonthlyVariantId: 'v-starter-m',
    });
    expect(isBillingWebhookConfigured(config)).toBe(false);
    expect(isBillingCheckoutConfigured(config)).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'starter', 'monthly')).toBe(true);
  });

  it('isBillingCheckoutConfigured is true with base env only (no variant IDs)', () => {
    const config = baseConfig();
    expect(hasLemonBaseCheckoutConfig(config)).toBe(true);
    expect(isBillingCheckoutConfigured(config)).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'starter')).toBe(false);
  });

  it('returns null lemon config when base env is missing', () => {
    const config = baseConfig({ lemonSqueezyApiKey: '' });
    expect(resolveLemonSqueezyBillingConfig(config)).toBeNull();
    expect(isPlanCheckoutAvailable(config, 'starter')).toBe(false);
  });
});
