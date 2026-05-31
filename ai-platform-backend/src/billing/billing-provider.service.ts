import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  getRequiredEnvKeysForAddonCheckout,
  getRequiredEnvKeysForPlanCheckout,
  getRequiredEnvKeysForTopUpCheckout,
  hasLemonBaseCheckoutConfig,
  isAddonCheckoutAvailable,
  isBillingCheckoutConfigured,
  isPlanCheckoutAvailable,
  isAutoTopUpCheckoutAvailable,
  isTopUpCheckoutAvailable,
  readMergedBillingAppConfig,
} from './billing-config.util';

import { LemonSqueezyProvider } from './providers/lemon-squeezy.provider';

import type { BillingInterval } from './billing-interval.types';

import type {
  BillingAddonCheckoutKey,
  BillingPlanCheckoutKey,
  BillingProviderAdapter,
  BillingTopUpCheckoutKey,
  BillingWebhookEvent,
  BillingWebhookHeaders,
  CreateAddonCheckoutInput,
  CreateSubscriptionCheckoutInput,
  CreateAutoTopUpCheckoutInput,
  CreateTopUpCheckoutInput,
  GetCustomerPortalInput,
  CancelProviderSubscriptionInput,
  ChangeProviderSubscriptionPlanInput,
  ChangeProviderAddonBillingIntervalInput,
  RestoreProviderSubscriptionInput,
  BillingOrderInvoiceDetails,
} from './billing-provider.types';

@Injectable()
export class BillingProviderService {
  constructor(
    private readonly configService: ConfigService,
    private readonly lemonSqueezyProvider: LemonSqueezyProvider,
  ) {}

  private readAppConfig() {
    return readMergedBillingAppConfig(this.configService);
  }

  /** Lemon base env present (API key, store, customer app URL). */
  isCheckoutConfigured(): boolean {
    return isBillingCheckoutConfigured(this.readAppConfig());
  }

  isPlanCheckoutAvailable(
    planKey: BillingPlanCheckoutKey,
    billingInterval: BillingInterval = 'monthly',
  ): boolean {
    return isPlanCheckoutAvailable(this.readAppConfig(), planKey, billingInterval);
  }

  isAddonCheckoutAvailable(
    addonKey: BillingAddonCheckoutKey,
    billingInterval: BillingInterval = 'monthly',
  ): boolean {
    return isAddonCheckoutAvailable(this.readAppConfig(), addonKey, billingInterval);
  }

  isTopUpCheckoutAvailable(topUpKey: BillingTopUpCheckoutKey): boolean {
    return isTopUpCheckoutAvailable(this.readAppConfig(), topUpKey);
  }

  isAutoTopUpCheckoutAvailable(): boolean {
    return isAutoTopUpCheckoutAvailable(this.readAppConfig());
  }

  private assertAutoTopUpCheckoutConfigured(): void {
    if (!this.isAutoTopUpCheckoutAvailable()) {
      throw new ServiceUnavailableException({
        error: 'Billing provider is not configured for auto top-up.',
        errorCode: 'billing_provider_not_configured',
        requiredEnv: [...getRequiredEnvKeysForTopUpCheckout('ai_credits_1000'), 'LEMON_SQUEEZY_AUTO_TOPUP_VARIANT_ID'],
      });
    }
  }

  private assertPlanCheckoutConfigured(
    planKey: BillingPlanCheckoutKey,
    billingInterval: BillingInterval = 'monthly',
  ): void {
    if (!this.isPlanCheckoutAvailable(planKey, billingInterval)) {
      throw new ServiceUnavailableException({
        error: 'Billing provider is not configured for this plan.',
        errorCode: 'billing_provider_not_configured',
        requiredEnv: getRequiredEnvKeysForPlanCheckout(planKey, billingInterval),
      });
    }
  }

  private assertAddonCheckoutConfigured(
    addonKey: BillingAddonCheckoutKey,
    billingInterval: BillingInterval = 'monthly',
  ): void {
    if (!this.isAddonCheckoutAvailable(addonKey, billingInterval)) {
      throw new ServiceUnavailableException({
        error: 'Billing provider is not configured for this add-on.',
        errorCode: 'billing_provider_not_configured',
        requiredEnv: getRequiredEnvKeysForAddonCheckout(addonKey, billingInterval),
      });
    }
  }

  private assertTopUpCheckoutConfigured(topUpKey: BillingTopUpCheckoutKey): void {
    if (!this.isTopUpCheckoutAvailable(topUpKey)) {
      throw new ServiceUnavailableException({
        error: 'Billing provider is not configured for this top-up.',
        errorCode: 'billing_provider_not_configured',
        requiredEnv: getRequiredEnvKeysForTopUpCheckout(topUpKey),
      });
    }
  }

  private getAdapter(): BillingProviderAdapter {
    return this.lemonSqueezyProvider;
  }

  async createSubscriptionCheckout(input: CreateSubscriptionCheckoutInput) {
    this.assertPlanCheckoutConfigured(input.planKey, input.billingInterval ?? 'monthly');
    return await this.getAdapter().createSubscriptionCheckout(input);
  }

  async createAddonCheckout(input: CreateAddonCheckoutInput) {
    this.assertAddonCheckoutConfigured(input.addonKey, input.billingInterval ?? 'monthly');
    return await this.getAdapter().createAddonCheckout(input);
  }

  async createTopUpCheckout(input: CreateTopUpCheckoutInput) {
    this.assertTopUpCheckoutConfigured(input.topUpKey);
    return await this.getAdapter().createTopUpCheckout(input);
  }

  async createAutoTopUpCheckout(input: CreateAutoTopUpCheckoutInput) {
    this.assertAutoTopUpCheckoutConfigured();
    return await this.getAdapter().createAutoTopUpCheckout(input);
  }

  async recordAutoTopUpUsage(input: { providerSubscriptionItemId: string; quantity: number }) {
    this.assertBaseBillingConfigured();
    const adapter = this.getAdapter();
    if (!adapter.recordAutoTopUpUsage) return;
    await adapter.recordAutoTopUpUsage(input);
  }

  parseWebhook(rawBody: Buffer, headers: BillingWebhookHeaders): BillingWebhookEvent {
    return this.getAdapter().parseWebhook(rawBody, headers);
  }

  verifyWebhookSignature(rawBody: Buffer, headers: BillingWebhookHeaders): boolean {
    return this.getAdapter().verifyWebhookSignature(rawBody, headers);
  }

  mapWebhookEvent(event: BillingWebhookEvent) {
    return this.getAdapter().mapWebhookEvent(event);
  }

  async getCustomerPortalUrl(
    input: Parameters<BillingProviderAdapter['getCustomerPortalUrl']>[0],
  ) {
    if (!hasLemonBaseCheckoutConfig(this.readAppConfig())) {
      return null;
    }
    return await this.getAdapter().getCustomerPortalUrl(input);
  }

  async fetchProviderSubscription(providerSubscriptionId: string) {
    if (!hasLemonBaseCheckoutConfig(this.readAppConfig())) {
      return null;
    }
    return await this.getAdapter().fetchProviderSubscription(providerSubscriptionId);
  }

  async listSubscriptionInvoices(
    providerSubscriptionId: string,
    options?: { planKey?: string },
  ) {
    if (!hasLemonBaseCheckoutConfig(this.readAppConfig())) {
      return [];
    }
    return await this.getAdapter().listSubscriptionInvoices(providerSubscriptionId, options);
  }

  async listCustomerPlanSubscriptions(providerCustomerId: string) {
    if (!hasLemonBaseCheckoutConfig(this.readAppConfig())) {
      return [];
    }
    const adapter = this.getAdapter();
    if (!adapter.listCustomerPlanSubscriptions) return [];
    return await adapter.listCustomerPlanSubscriptions(providerCustomerId);
  }

  async fetchOrderInvoice(providerOrderId: string) {
    if (!hasLemonBaseCheckoutConfig(this.readAppConfig())) {
      return null;
    }
    return await this.getAdapter().fetchOrderInvoice(providerOrderId);
  }

  async generateOrderInvoice(
    providerOrderId: string,
    details: BillingOrderInvoiceDetails,
    options?: { requestId?: string },
  ) {
    this.assertBaseBillingConfigured();
    return await this.getAdapter().generateOrderInvoice(providerOrderId, details, options);
  }

  private assertBaseBillingConfigured(): void {
    if (!hasLemonBaseCheckoutConfig(this.readAppConfig())) {
      throw new ServiceUnavailableException({
        error: 'Billing provider is not configured.',
        errorCode: 'billing_provider_not_configured',
      });
    }
  }

  async cancelSubscription(input: CancelProviderSubscriptionInput) {
    this.assertBaseBillingConfigured();
    return await this.getAdapter().cancelSubscription(input);
  }

  async changeSubscriptionPlan(input: ChangeProviderSubscriptionPlanInput) {
    this.assertBaseBillingConfigured();
    return await this.getAdapter().changeSubscriptionPlan(input);
  }

  async changeAddonBillingInterval(input: ChangeProviderAddonBillingIntervalInput) {
    this.assertBaseBillingConfigured();
    return await this.getAdapter().changeAddonBillingInterval(input);
  }

  async restoreSubscription(input: RestoreProviderSubscriptionInput) {
    this.assertBaseBillingConfigured();
    return await this.getAdapter().restoreSubscription(input);
  }
}
