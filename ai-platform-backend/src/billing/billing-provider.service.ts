import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { configFactory, type AppConfig } from '../config/config.factory';

import {

  getRequiredEnvKeysForAddonCheckout,

  getRequiredEnvKeysForPlanCheckout,

  getRequiredEnvKeysForTopUpCheckout,

  hasLemonBaseCheckoutConfig,

  isAddonCheckoutAvailable,

  isBillingCheckoutConfigured,

  isPlanCheckoutAvailable,

  isTopUpCheckoutAvailable,

} from './billing-config.util';

import { LemonSqueezyProvider } from './providers/lemon-squeezy.provider';

import type {

  BillingAddonCheckoutKey,

  BillingPlanCheckoutKey,

  BillingProviderAdapter,

  BillingTopUpCheckoutKey,

  BillingWebhookEvent,

  BillingWebhookHeaders,

  CreateAddonCheckoutInput,

  CreateSubscriptionCheckoutInput,

  CreateTopUpCheckoutInput,

  GetCustomerPortalInput,

  CancelProviderSubscriptionInput,

  ChangeProviderSubscriptionPlanInput,

  RestoreProviderSubscriptionInput,

  BillingOrderInvoiceDetails,

} from './billing-provider.types';



@Injectable()

export class BillingProviderService {

  constructor(

    private readonly configService: ConfigService,

    private readonly lemonSqueezyProvider: LemonSqueezyProvider,

  ) {}



  private readAppConfig(): AppConfig {

    return {

      ...configFactory(),

      lemonSqueezyApiKey: this.configService.get<string>('lemonSqueezyApiKey') ?? '',

      lemonSqueezyStoreId: this.configService.get<string>('lemonSqueezyStoreId') ?? '',

      lemonSqueezyWebhookSecret: this.configService.get<string>('lemonSqueezyWebhookSecret') ?? '',

      customerAppBaseUrl: this.configService.get<string>('customerAppBaseUrl') ?? '',

      lemonSqueezyStarterVariantId: this.configService.get<string>('lemonSqueezyStarterVariantId') ?? '',

      lemonSqueezyProVariantId: this.configService.get<string>('lemonSqueezyProVariantId') ?? '',

      lemonSqueezyAddonExtraBotVariantId:

        this.configService.get<string>('lemonSqueezyAddonExtraBotVariantId') ?? '',

      lemonSqueezyAddonRemoveBrandingVariantId:

        this.configService.get<string>('lemonSqueezyAddonRemoveBrandingVariantId') ?? '',

      lemonSqueezyTopup1000CreditsVariantId:

        this.configService.get<string>('lemonSqueezyTopup1000CreditsVariantId') ?? '',

    };

  }



  /** Lemon base env present (API key, store, customer app URL). */

  isCheckoutConfigured(): boolean {

    return isBillingCheckoutConfigured(this.readAppConfig());

  }



  isPlanCheckoutAvailable(planKey: BillingPlanCheckoutKey): boolean {

    return isPlanCheckoutAvailable(this.readAppConfig(), planKey);

  }



  isAddonCheckoutAvailable(addonKey: BillingAddonCheckoutKey): boolean {

    return isAddonCheckoutAvailable(this.readAppConfig(), addonKey);

  }



  isTopUpCheckoutAvailable(topUpKey: BillingTopUpCheckoutKey): boolean {

    return isTopUpCheckoutAvailable(this.readAppConfig(), topUpKey);

  }



  private assertPlanCheckoutConfigured(planKey: BillingPlanCheckoutKey): void {

    if (!this.isPlanCheckoutAvailable(planKey)) {

      throw new ServiceUnavailableException({

        error: 'Billing provider is not configured for this plan.',

        errorCode: 'billing_provider_not_configured',

        requiredEnv: getRequiredEnvKeysForPlanCheckout(planKey),

      });

    }

  }



  private assertAddonCheckoutConfigured(addonKey: BillingAddonCheckoutKey): void {

    if (!this.isAddonCheckoutAvailable(addonKey)) {

      throw new ServiceUnavailableException({

        error: 'Billing provider is not configured for this add-on.',

        errorCode: 'billing_provider_not_configured',

        requiredEnv: getRequiredEnvKeysForAddonCheckout(addonKey),

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

    this.assertPlanCheckoutConfigured(input.planKey);

    return await this.getAdapter().createSubscriptionCheckout(input);

  }



  async createAddonCheckout(input: CreateAddonCheckoutInput) {

    this.assertAddonCheckoutConfigured(input.addonKey);

    return await this.getAdapter().createAddonCheckout(input);

  }



  async createTopUpCheckout(input: CreateTopUpCheckoutInput) {

    this.assertTopUpCheckoutConfigured(input.topUpKey);

    return await this.getAdapter().createTopUpCheckout(input);

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

  async restoreSubscription(input: RestoreProviderSubscriptionInput) {
    this.assertBaseBillingConfigured();
    return await this.getAdapter().restoreSubscription(input);
  }

}


