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
    lemonSqueezyStarterVariantId: '',
    lemonSqueezyProVariantId: '',
    lemonSqueezyAddonExtraBotVariantId: '',
    lemonSqueezyAddonRemoveBrandingVariantId: '',
    lemonSqueezyTopup1000CreditsVariantId: '',
    ...overrides,
  } as AppConfig;
}

describe('billing-config.util checkout availability', () => {
  it('Starter checkout is true when Starter variant exists but add-on variants are missing', () => {
    const config = baseConfig({
      lemonSqueezyStarterVariantId: 'v-starter',
    });
    expect(isPlanCheckoutAvailable(config, 'starter')).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'pro')).toBe(false);
    expect(isAddonCheckoutAvailable(config, 'extra_bot')).toBe(false);
    expect(isTopUpCheckoutAvailable(config, 'ai_credits_1000')).toBe(false);
    expect(resolveLemonSqueezyBillingConfig(config)?.variantIds.starter).toBe('v-starter');
  });

  it('Pro checkout is true when Pro variant exists but add-on variants are missing', () => {
    const config = baseConfig({
      lemonSqueezyProVariantId: 'v-pro',
    });
    expect(isPlanCheckoutAvailable(config, 'pro')).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'starter')).toBe(false);
    expect(isAddonCheckoutAvailable(config, 'remove_branding')).toBe(false);
  });

  it('missing Starter variant only disables Starter', () => {
    const config = baseConfig({
      lemonSqueezyProVariantId: 'v-pro',
      lemonSqueezyStarterVariantId: '',
    });
    expect(isPlanCheckoutAvailable(config, 'starter')).toBe(false);
    expect(isPlanCheckoutAvailable(config, 'pro')).toBe(true);
  });

  it('missing Pro variant only disables Pro', () => {
    const config = baseConfig({
      lemonSqueezyStarterVariantId: 'v-starter',
      lemonSqueezyProVariantId: '',
    });
    expect(isPlanCheckoutAvailable(config, 'starter')).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'pro')).toBe(false);
  });

  it('add-on availability is independent per add-on', () => {
    const config = baseConfig({
      lemonSqueezyAddonExtraBotVariantId: 'v-bot',
      lemonSqueezyAddonRemoveBrandingVariantId: 'v-branding',
    });
    expect(isAddonCheckoutAvailable(config, 'extra_bot')).toBe(true);
    expect(isAddonCheckoutAvailable(config, 'remove_branding')).toBe(true);
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
      lemonSqueezyStarterVariantId: 'v-starter',
    });
    expect(isBillingWebhookConfigured(config)).toBe(false);
    expect(isBillingCheckoutConfigured(config)).toBe(true);
    expect(isPlanCheckoutAvailable(config, 'starter')).toBe(true);
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
