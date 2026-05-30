import type { PlanKey } from '../entitlements/plan-catalog';
import type { ProviderInvoiceRow, ProviderPaymentMethodSummary } from './billing-invoice.types';
export type { ProviderInvoiceRow, ProviderPaymentMethodSummary, SubscriptionPaymentFailureMetadata } from './billing-invoice.types';
import type { BillingOrderInvoiceDetails, BillingInvoiceDownloadResult } from './billing-invoice-download.types';
export type { BillingOrderInvoiceDetails, BillingInvoiceDownloadResult } from './billing-invoice-download.types';

/** Payment providers supported by the billing abstraction. */
export const BILLING_PROVIDERS = ['lemon_squeezy', 'stripe_future'] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const CHECKOUT_TYPES = ['plan', 'addon', 'top_up'] as const;
export type CheckoutType = (typeof CHECKOUT_TYPES)[number];

/** Paid plan keys available for subscription checkout (not free). */
export const BILLING_PLAN_CHECKOUT_KEYS = ['starter', 'pro'] as const;
export type BillingPlanCheckoutKey = (typeof BILLING_PLAN_CHECKOUT_KEYS)[number];

export const BILLING_ADDON_CHECKOUT_KEYS = [
  'extra_bot',
  'remove_branding',
] as const;
export type BillingAddonCheckoutKey = (typeof BILLING_ADDON_CHECKOUT_KEYS)[number];

export const BILLING_TOP_UP_CHECKOUT_KEYS = ['ai_credits_1000'] as const;
export type BillingTopUpCheckoutKey = (typeof BILLING_TOP_UP_CHECKOUT_KEYS)[number];

export type BillingCheckoutCustomData = {
  workspaceId: string;
  userId: string;
  checkoutType: CheckoutType;
  internalRequestId: string;
  planKey?: BillingPlanCheckoutKey;
  addonKey?: BillingAddonCheckoutKey;
  topUpKey?: BillingTopUpCheckoutKey;
  targetBotId?: string;
};

export type CreateSubscriptionCheckoutInput = {
  workspaceId: string;
  userId: string;
  planKey: BillingPlanCheckoutKey;
  internalRequestId: string;
};

export type CreateAddonCheckoutInput = {
  workspaceId: string;
  userId: string;
  addonKey: BillingAddonCheckoutKey;
  targetBotId?: string;
  internalRequestId: string;
};

export type CreateTopUpCheckoutInput = {
  workspaceId: string;
  userId: string;
  topUpKey: BillingTopUpCheckoutKey;
  internalRequestId: string;
};

export type BillingCheckoutResult = {
  checkoutUrl: string;
  provider: BillingProvider;
};

export type GetCustomerPortalInput = {
  providerSubscriptionId: string;
};

export type BillingCustomerPortalResult = {
  url: string;
  provider: BillingProvider;
};

/** Latest subscription state from the payment provider (admin sync). */
export type ProviderSubscriptionSnapshot = {
  providerCustomerId?: string;
  providerVariantId?: string;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  planKey?: PlanKey;
};

export type CancelProviderSubscriptionInput = {
  providerSubscriptionId: string;
};

export type RestoreProviderSubscriptionInput = {
  providerSubscriptionId: string;
};

export type ChangeProviderSubscriptionPlanInput = {
  providerSubscriptionId: string;
  planKey: BillingPlanCheckoutKey;
  disableProrations?: boolean;
};

export class BillingProviderActionError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'BillingProviderActionError';
  }
}

export type BillingWebhookHeaders = Record<string, string | string[] | undefined>;

/** Normalized webhook event after provider-specific parsing. */
export type BillingWebhookEvent = {
  provider: BillingProvider;
  providerEventId: string;
  eventName: string;
  customData: Record<string, string>;
  payload: unknown;
};

/** Internal actions derived from webhook events. */
export type BillingWebhookAction =
  | {
      kind: 'subscription_sync';
      workspaceId: string;
      planKey?: PlanKey;
      providerCustomerId?: string;
      providerSubscriptionId: string;
      providerVariantId?: string;
      status: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
      paymentFailure?: {
        failedAt?: Date;
        invoiceId?: string | null;
        invoiceUrl?: string | null;
        amount?: number | null;
        currency?: string | null;
        cardBrand?: string | null;
        cardLastFour?: string | null;
      };
      clearPaymentFailure?: boolean;
      paymentMethod?: ProviderPaymentMethodSummary | null;
    }
  | {
      kind: 'top_up_credit';
      workspaceId: string;
      topUpKey: BillingTopUpCheckoutKey;
      providerOrderId: string;
      creditsPurchased: number;
    }
  | {
      kind: 'order_record';
      workspaceId: string;
      providerOrderId: string;
      checkoutType: CheckoutType;
      planKey?: BillingPlanCheckoutKey;
      addonKey?: BillingAddonCheckoutKey;
      topUpKey?: BillingTopUpCheckoutKey;
      targetBotId?: string;
      providerSubscriptionId?: string;
      amountCents: number;
      currency: string;
      status: string;
      invoiceUrl?: string | null;
      receiptUrl?: string | null;
      orderCreatedAt?: Date;
    }
  | {
      kind: 'addon_sync';
      workspaceId: string;
      addonKey: BillingAddonCheckoutKey;
      targetBotId?: string;
      status: 'active' | 'cancelled' | 'expired';
      providerSubscriptionId?: string;
      providerOrderId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
    }
  | { kind: 'ignored'; reason: string };

export interface BillingProviderAdapter {
  readonly provider: BillingProvider;

  createSubscriptionCheckout(input: CreateSubscriptionCheckoutInput): Promise<BillingCheckoutResult>;

  createAddonCheckout(input: CreateAddonCheckoutInput): Promise<BillingCheckoutResult>;

  createTopUpCheckout(input: CreateTopUpCheckoutInput): Promise<BillingCheckoutResult>;

  parseWebhook(rawBody: Buffer, headers: BillingWebhookHeaders): BillingWebhookEvent;

  verifyWebhookSignature(rawBody: Buffer, headers: BillingWebhookHeaders): boolean;

  mapWebhookEvent(
    event: BillingWebhookEvent,
  ): Promise<BillingWebhookAction | BillingWebhookAction[]>;

  /**
   * Fresh signed customer portal URL (e.g. Lemon subscription urls.customer_portal).
   * Returns null when the provider has no portal URL for this subscription.
   */
  getCustomerPortalUrl(input: GetCustomerPortalInput): Promise<BillingCustomerPortalResult | null>;

  fetchProviderSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionSnapshot | null>;

  listSubscriptionInvoices(
    providerSubscriptionId: string,
    options?: { planKey?: string },
  ): Promise<ProviderInvoiceRow[]>;

  listCustomerPlanSubscriptions?(
    providerCustomerId: string,
  ): Promise<Array<{ providerSubscriptionId: string; planKey?: PlanKey; providerVariantId?: string }>>;

  fetchOrderInvoice(providerOrderId: string): Promise<ProviderInvoiceRow | null>;

  generateOrderInvoice(
    providerOrderId: string,
    details: BillingOrderInvoiceDetails,
    options?: { requestId?: string },
  ): Promise<BillingInvoiceDownloadResult>;

  cancelSubscription(input: CancelProviderSubscriptionInput): Promise<ProviderSubscriptionSnapshot>;

  restoreSubscription(input: RestoreProviderSubscriptionInput): Promise<ProviderSubscriptionSnapshot>;

  changeSubscriptionPlan(input: ChangeProviderSubscriptionPlanInput): Promise<ProviderSubscriptionSnapshot>;
}

export function isBillingPlanCheckoutKey(value: string): value is BillingPlanCheckoutKey {
  return (BILLING_PLAN_CHECKOUT_KEYS as readonly string[]).includes(value);
}

export function isBillingAddonCheckoutKey(value: string): value is BillingAddonCheckoutKey {
  return (BILLING_ADDON_CHECKOUT_KEYS as readonly string[]).includes(value);
}

export function isBillingTopUpCheckoutKey(value: string): value is BillingTopUpCheckoutKey {
  return (BILLING_TOP_UP_CHECKOUT_KEYS as readonly string[]).includes(value);
}
